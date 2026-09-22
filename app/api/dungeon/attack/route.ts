import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { loadOwnedHeroesWithStats } from "@/lib/game/heroLoader";
import { computeRaidRewards, simulateDungeonAttack } from "@/lib/game/engine/combat";
import type { BattleLog, Dungeon, ResourceKind, UserProfile } from "@/types/game";

interface Body {
  defenderId: string;
  heroIds: string[];
}

/** Resolves an asynchronous PvP attack against another player's dungeon. */
export const POST = withAuth(async (uid, request) => {
  const { defenderId, heroIds } = (await request.json()) as Body;
  if (defenderId === uid) throw new GameError("Vous ne pouvez pas attaquer votre propre donjon");
  if (heroIds.length === 0) throw new GameError("Sélectionnez au moins un héros");

  const [dungeonSnap, defenderSnap, resolvedHeroes] = await Promise.all([
    adminDb.collection("dungeons").doc(defenderId).get(),
    adminDb.collection("users").doc(defenderId).get(),
    loadOwnedHeroesWithStats(uid, heroIds),
  ]);

  if (!dungeonSnap.exists || !defenderSnap.exists) {
    throw new GameError("Ce donjon n'existe pas");
  }

  for (const { hero } of resolvedHeroes) {
    if (hero.status !== "idle") {
      throw new GameError(`${hero.name} n'est pas disponible (en expédition ?)`);
    }
  }

  const dungeon = dungeonSnap.data() as Dungeon;
  const defender = defenderSnap.data() as UserProfile;

  const seed = `${uid}:${defenderId}:${Date.now()}`;
  const attackers = resolvedHeroes.map(({ hero, stats }) => ({
    id: hero.id,
    name: hero.name,
    role: hero.role,
    stats,
  }));
  const { outcome, rounds } = simulateDungeonAttack(attackers, dungeon, seed);
  const rewards = computeRaidRewards(outcome, defender.gold, defender.resources);
  const defenseCrystalReward = outcome === "defaite" ? 2 : 0;

  const battleRef = adminDb.collection("battleLogs").doc();
  const battleLog: BattleLog = {
    id: battleRef.id,
    attackerId: uid,
    defenderId,
    outcome,
    rounds,
    rewards,
    createdAt: Date.now(),
  };

  await adminDb.runTransaction(async (tx) => {
    tx.set(battleRef, battleLog);

    const defenderRef = adminDb.collection("users").doc(defenderId);

    if (rewards.gold > 0 || Object.keys(rewards.resources).length > 0) {
      const attackerRef = adminDb.collection("users").doc(uid);
      const attackerSnap = await tx.get(attackerRef);
      const attacker = attackerSnap.data() as UserProfile;

      const nextAttackerResources = { ...attacker.resources };
      const nextDefenderResources = { ...defender.resources };
      for (const [kind, amount] of Object.entries(rewards.resources) as [
        ResourceKind,
        number,
      ][]) {
        nextAttackerResources[kind] = (nextAttackerResources[kind] ?? 0) + amount;
        nextDefenderResources[kind] = Math.max(0, (nextDefenderResources[kind] ?? 0) - amount);
      }

      tx.update(attackerRef, {
        gold: attacker.gold + rewards.gold,
        resources: nextAttackerResources,
      });
      tx.update(defenderRef, {
        gold: Math.max(0, defender.gold - rewards.gold),
        resources: nextDefenderResources,
      });
    } else if (defenseCrystalReward > 0) {
      tx.update(defenderRef, { crystals: defender.crystals + defenseCrystalReward });
    }
  });

  return NextResponse.json({ battleLog });
});
