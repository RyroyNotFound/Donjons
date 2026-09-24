import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getZone, ZONES } from "@/lib/game/content/zones";
import { DIFFICULTIES, getDifficulty, recordKey, zoneAtDifficulty } from "@/lib/game/content/difficulties";
import { loadOwnedHeroesWithStats } from "@/lib/game/heroLoader";
import { rollExpeditionLoot, type ExpeditionClaimResponse } from "@/lib/game/engine/loot";
import { applyXpGain } from "@/lib/game/engine/xp";
import { totalTalentPointsForLevel } from "@/lib/game/engine/stats";
import { levelCapForStar } from "@/lib/game/economy";
import { maxKillsUntil, runStars } from "@/lib/game/arena/engine";
import type { ArenaRunResult, Expedition, Item, ResourceKind, UserProfile, ZoneDefinition } from "@/types/game";

interface Body {
  expeditionId: string;
  result: ArenaRunResult;
}

const MIN_RUN_MS = 2000;
/** Wall-clock slack when checking the reported run time (network, tab switching). */
const WALL_CLOCK_SLACK_SEC = 3;
/** First victory of the (UTC) day in each zone, whatever the difficulty. */
const DAILY_BONUS = { crystals: 2, rankTokens: 1 };

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Clamps the client-reported run to what the zone's deterministic spawn schedule allows. */
function sanitizeResult(result: ArenaRunResult, zone: ZoneDefinition, wallSec: number, partySize: number) {
  const timeSec = Math.min(zone.durationSec, Math.max(0, (Number(result.timeSurvivedMs) || 0) / 1000));
  if (timeSec > wallSec + WALL_CLOCK_SLACK_SEC) throw new GameError("Résultat de partie incohérent");
  const killCount = Math.min(maxKillsUntil(zone, timeSec), Math.max(0, Math.floor(Number(result.killCount) || 0)));
  const bossKilled = !!result.bossKilled && timeSec >= zone.boss.spawnAtSec;
  const survived = !!result.survived && (bossKilled || timeSec >= zone.durationSec - 0.5);
  const heroesKo = Math.min(partySize, Math.max(0, Math.floor(Number(result.heroesKo) || 0)));
  return { timeSec, killCount, bossKilled, survived, heroesKo };
}

/** 0.3..1.5 loot multiplier from how the run went. */
function performanceFactor(run: ReturnType<typeof sanitizeResult>, zone: ZoneDefinition, stars: number): number {
  const maxKills = Math.max(1, maxKillsUntil(zone, run.timeSec));
  const killBonus = 0.2 * (run.killCount / maxKills);
  const base = run.survived ? 1 + 0.15 * (stars - 1) : 0.3 + 0.5 * (run.timeSec / zone.durationSec);
  return Math.min(1.5, Math.max(0.3, base + killBonus));
}

/** Claims a finished arena run: validates it, rolls loot, grants XP, updates the zone record, frees the heroes. */
export const POST = withAuth(async (uid, request) => {
  const { expeditionId, result } = (await request.json()) as Body;
  const expeditionRef = adminDb.collection("expeditions").doc(expeditionId);
  const expeditionSnap = await expeditionRef.get();
  if (!expeditionSnap.exists) throw new GameError("Expédition introuvable");
  const expedition = expeditionSnap.data() as Expedition;

  if (expedition.ownerId !== uid) throw new GameError("Cette expédition ne vous appartient pas");
  if (expedition.status !== "active") throw new GameError("Expédition déjà réclamée");
  const wallMs = Date.now() - expedition.startedAt;
  if (wallMs < MIN_RUN_MS) throw new GameError("Partie trop courte pour être validée");

  const difficulty = getDifficulty(expedition.difficulty);
  const baseZone = getZone(expedition.zoneId);
  const zone = zoneAtDifficulty(baseZone, difficulty.id);
  const run = sanitizeResult(result, zone, wallMs / 1000, expedition.heroIds.length);
  const stars = runStars(run);
  const performance = performanceFactor(run, zone, stars);
  const loot = rollExpeditionLoot(zone, performance, run.bossKilled, expeditionId, difficulty.id);
  const xpGained = Math.round(
    zone.xpReward * (run.survived ? 1 : 0.4 + 0.4 * (run.timeSec / zone.durationSec)) * (run.bossKilled ? 1.2 : 1),
  );
  const resolvedHeroes = await loadOwnedHeroesWithStats(uid, expedition.heroIds);

  const userRef = adminDb.collection("users").doc(uid);

  const response = await adminDb.runTransaction(async (tx) => {
    // Re-check inside the transaction: two concurrent claims must not both pay out.
    const freshExpedition = await tx.get(expeditionRef);
    if ((freshExpedition.data() as Expedition | undefined)?.status !== "active") {
      throw new GameError("Expédition déjà réclamée");
    }
    const userSnap = await tx.get(userRef);
    const user = userSnap.data() as UserProfile;

    const records = { ...(user.expeditionRecords ?? {}) };
    const key = recordKey(zone.id, difficulty.id);
    const previous = records[key] ?? { bestStars: 0, clears: 0 };
    records[key] = {
      ...previous,
      bestStars: Math.max(previous.bestStars, stars),
      clears: previous.clears + (run.survived ? 1 : 0),
    };
    const firstClear = previous.bestStars === 0 && stars >= 1;
    const firstThreeStars = previous.bestStars < 3 && stars === 3;

    // Daily bonus lives on the zone's normal record (always cleared before any harder tier opens).
    const today = utcDay(Date.now());
    const baseRecord = records[zone.id];
    const dailyBonus = run.survived && !!baseRecord && baseRecord.dailyBonusDay !== today;
    if (dailyBonus) records[zone.id] = { ...baseRecord, dailyBonusDay: today };

    const crystalsEarned =
      (run.survived ? 1 + Math.floor(zone.difficulty / 25) + difficulty.crystalBonus : 0) +
      (firstClear ? difficulty.firstClear.crystals : 0) +
      (firstThreeStars ? difficulty.firstThreeStars.crystals : 0) +
      (dailyBonus ? DAILY_BONUS.crystals : 0);
    const rankTokensEarned =
      (firstClear ? difficulty.firstClear.rankTokens : 0) +
      (firstThreeStars ? difficulty.firstThreeStars.rankTokens : 0) +
      (dailyBonus ? DAILY_BONUS.rankTokens : 0);
    const unlockedZone =
      firstClear && difficulty.id === "normal" ? ZONES.find((z) => z.unlockRequires === zone.id) : undefined;
    const nextDifficulty = DIFFICULTIES[DIFFICULTIES.findIndex((d) => d.id === difficulty.id) + 1];
    const unlockedDifficulty = previous.bestStars < 2 && stars >= 2 ? nextDifficulty : undefined;

    const nextResources = { ...user.resources };
    for (const [kind, amount] of Object.entries(loot.resources) as [ResourceKind, number][]) {
      nextResources[kind] = (nextResources[kind] ?? 0) + amount;
    }

    const nextCaptured = { ...(user.capturedMonsters ?? {}) };
    if (loot.monsterCaptured) {
      nextCaptured[loot.monsterCaptured] = (nextCaptured[loot.monsterCaptured] ?? 0) + 1;
    }

    tx.update(userRef, {
      gold: user.gold + loot.gold,
      crystals: user.crystals + crystalsEarned,
      rankTokens: (user.rankTokens ?? 0) + rankTokensEarned,
      resources: nextResources,
      capturedMonsters: nextCaptured,
      expeditionRecords: records,
    });

    const levelUps: ExpeditionClaimResponse["levelUps"] = [];
    for (const { hero } of resolvedHeroes) {
      const maxLevel = levelCapForStar(hero.starRank ?? 1);
      const { level, xp } = applyXpGain(hero.level, hero.xp, xpGained, maxLevel);
      const gainedTalentPoints = totalTalentPointsForLevel(level) - totalTalentPointsForLevel(hero.level);
      if (level > hero.level) levelUps.push({ heroId: hero.id, name: hero.name, from: hero.level, to: level });
      tx.update(adminDb.collection("heroes").doc(hero.id), {
        status: "idle",
        level,
        xp,
        talentPoints: hero.talentPoints + Math.max(0, gainedTalentPoints),
      });
    }

    if (loot.item) {
      const itemRef = adminDb.collection("items").doc();
      const item: Item = { id: itemRef.id, ownerId: uid, ...loot.item, enhanceLevel: 0 };
      tx.set(itemRef, item);
    }

    tx.update(expeditionRef, { status: "claimed" });

    const claim: ExpeditionClaimResponse = {
      loot,
      survived: run.survived,
      stars,
      bossKilled: run.bossKilled,
      killCount: run.killCount,
      crystalsEarned,
      rankTokensEarned,
      dailyBonus,
      difficulty: difficulty.id,
      xpGained,
      levelUps,
      newBestStars: stars > previous.bestStars,
      unlockedZoneName: unlockedZone?.name,
      unlockedDifficultyName: unlockedDifficulty?.name,
    };
    return claim;
  });

  return NextResponse.json(response);
});
