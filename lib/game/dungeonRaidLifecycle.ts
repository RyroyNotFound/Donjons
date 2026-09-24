import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { isBotDefenderId } from "@/lib/game/content/botDungeons";
import { finalReward } from "@/lib/game/engine/dungeonRaid";
import type { DungeonRaid, ResourceKind, UserProfile } from "@/types/game";

const DEFEAT_CONSOLATION_CRYSTALS = 2;

/** Pays out a just-finished raid's reward, debits a real defender's stash, and frees the attacker's heroes. */
export async function finalizeRaid(raid: DungeonRaid): Promise<void> {
  const reward = finalReward(raid);
  const attackerRef = adminDb.collection("users").doc(raid.attackerId);

  await adminDb.runTransaction(async (tx) => {
    const attackerSnap = await tx.get(attackerRef);
    const attacker = attackerSnap.data() as UserProfile;
    const nextAttackerResources = { ...attacker.resources };
    for (const [kind, amount] of Object.entries(reward.resources) as [ResourceKind, number][]) {
      nextAttackerResources[kind] = (nextAttackerResources[kind] ?? 0) + amount;
    }
    tx.update(attackerRef, { gold: attacker.gold + reward.gold, resources: nextAttackerResources });

    if (!isBotDefenderId(raid.defenderId)) {
      const defenderRef = adminDb.collection("users").doc(raid.defenderId);
      const defenderSnap = await tx.get(defenderRef);
      if (defenderSnap.exists) {
        const defender = defenderSnap.data() as UserProfile;
        if (raid.status === "wiped") {
          tx.update(defenderRef, { crystals: defender.crystals + DEFEAT_CONSOLATION_CRYSTALS });
        } else {
          const nextDefenderResources = { ...defender.resources };
          for (const [kind, amount] of Object.entries(reward.resources) as [ResourceKind, number][]) {
            nextDefenderResources[kind] = Math.max(0, (nextDefenderResources[kind] ?? 0) - amount);
          }
          tx.update(defenderRef, {
            gold: Math.max(0, defender.gold - reward.gold),
            resources: nextDefenderResources,
          });
        }
      }
    }

    for (const hero of raid.heroes) {
      tx.update(adminDb.collection("heroes").doc(hero.id), { status: "idle" });
    }
  });
}
