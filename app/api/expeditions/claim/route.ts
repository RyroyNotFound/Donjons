import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getZone } from "@/lib/game/content/zones";
import { loadOwnedHeroesWithStats } from "@/lib/game/heroLoader";
import { rollExpeditionLoot } from "@/lib/game/engine/loot";
import { applyXpGain } from "@/lib/game/engine/xp";
import { totalTalentPointsForLevel } from "@/lib/game/engine/stats";
import { levelCapForStar } from "@/lib/game/economy";
import type { ArenaRunResult, Expedition, Item, ResourceKind, UserProfile } from "@/types/game";

interface Body {
  expeditionId: string;
  result: ArenaRunResult;
}

const XP_PER_EXPEDITION = 40;
const MIN_RUN_MS = 2000;

/** Turns the reported arena run into the loot power factor rollExpeditionLoot expects. */
function performanceFactor(result: ArenaRunResult, zone: { durationSec: number }): number {
  const survivedSec = Math.min(zone.durationSec, Math.max(0, result.timeSurvivedMs / 1000));
  const survivalRatio = zone.durationSec > 0 ? survivedSec / zone.durationSec : 0;
  const killRatio =
    result.spawnedCount > 0 ? Math.min(1, Math.max(0, result.killCount / result.spawnedCount)) : 0;
  const factor = 0.4 + survivalRatio * 0.6 + killRatio * 0.3;
  return Math.min(1.3, Math.max(0.4, factor));
}

/** Claims a finished arena run: rolls loot from the reported performance, grants XP, frees the heroes. */
export const POST = withAuth(async (uid, request) => {
  const { expeditionId, result } = (await request.json()) as Body;
  const expeditionRef = adminDb.collection("expeditions").doc(expeditionId);
  const expeditionSnap = await expeditionRef.get();
  if (!expeditionSnap.exists) throw new GameError("Expédition introuvable");
  const expedition = expeditionSnap.data() as Expedition;

  if (expedition.ownerId !== uid) throw new GameError("Cette expédition ne vous appartient pas");
  if (expedition.status !== "active") throw new GameError("Expédition déjà réclamée");
  if (Date.now() - expedition.startedAt < MIN_RUN_MS) {
    throw new GameError("Partie trop courte pour être validée");
  }

  const zone = getZone(expedition.zoneId);
  const resolvedHeroes = await loadOwnedHeroesWithStats(uid, expedition.heroIds);
  const factor = performanceFactor(result, zone);
  const loot = rollExpeditionLoot(zone, factor * zone.difficulty, expeditionId);
  const crystalsEarned = result.survived ? 1 + Math.floor(zone.difficulty / 20) : 0;

  const userRef = adminDb.collection("users").doc(uid);

  await adminDb.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const user = userSnap.data() as UserProfile;

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
      resources: nextResources,
      capturedMonsters: nextCaptured,
    });

    for (const { hero } of resolvedHeroes) {
      const maxLevel = levelCapForStar(hero.starRank ?? 1);
      const { level, xp } = applyXpGain(hero.level, hero.xp, XP_PER_EXPEDITION, maxLevel);
      const gainedTalentPoints =
        totalTalentPointsForLevel(level) - totalTalentPointsForLevel(hero.level);
      tx.update(adminDb.collection("heroes").doc(hero.id), {
        status: "idle",
        level,
        xp,
        talentPoints: hero.talentPoints + Math.max(0, gainedTalentPoints),
      });
    }

    if (loot.item) {
      const itemRef = adminDb.collection("items").doc();
      const item: Item = {
        id: itemRef.id,
        ownerId: uid,
        name: loot.item.name,
        slot: loot.item.slot,
        rarity: loot.item.rarity,
        statBonus: loot.item.statBonus,
      };
      tx.set(itemRef, item);
    }

    tx.update(expeditionRef, { status: "claimed" });
  });

  return NextResponse.json({ loot, survived: result.survived, crystalsEarned });
});
