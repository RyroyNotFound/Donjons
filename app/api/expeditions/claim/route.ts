import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getZone } from "@/lib/game/content/zones";
import { loadOwnedHeroesWithStats, teamPower } from "@/lib/game/heroLoader";
import { rollExpeditionLoot } from "@/lib/game/engine/loot";
import { applyXpGain } from "@/lib/game/engine/xp";
import { totalTalentPointsForLevel } from "@/lib/game/engine/stats";
import type { Expedition, Item, ResourceKind, UserProfile } from "@/types/game";

interface Body {
  expeditionId: string;
}

const XP_PER_EXPEDITION = 40;

/** Claims a finished expedition: rolls loot, grants XP, frees the heroes. */
export const POST = withAuth(async (uid, request) => {
  const { expeditionId } = (await request.json()) as Body;
  const expeditionRef = adminDb.collection("expeditions").doc(expeditionId);
  const expeditionSnap = await expeditionRef.get();
  if (!expeditionSnap.exists) throw new GameError("Expédition introuvable");
  const expedition = expeditionSnap.data() as Expedition;

  if (expedition.ownerId !== uid) throw new GameError("Cette expédition ne vous appartient pas");
  if (expedition.status !== "active") throw new GameError("Expédition déjà réclamée");

  const readyAt = expedition.startedAt + expedition.durationSec * 1000;
  if (Date.now() < readyAt) throw new GameError("L'expédition n'est pas encore terminée");

  const zone = getZone(expedition.zoneId);
  const resolvedHeroes = await loadOwnedHeroesWithStats(uid, expedition.heroIds);
  const power = teamPower(resolvedHeroes);
  const loot = rollExpeditionLoot(zone, power, expeditionId);

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
      resources: nextResources,
      capturedMonsters: nextCaptured,
    });

    for (const { hero } of resolvedHeroes) {
      const { level, xp } = applyXpGain(hero.level, hero.xp, XP_PER_EXPEDITION);
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

  return NextResponse.json({ loot });
});
