import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { newHeroData } from "@/lib/game/heroFactory";
import { getSubclass } from "@/lib/game/content/classes";
import { performPulls } from "@/lib/game/engine/gacha";
import { createRng } from "@/lib/game/engine/rng";
import { GACHA_PULL_COST } from "@/lib/game/content/gacha";
import { MAX_HEROES } from "@/lib/game/economy";
import type { Hero, UserProfile } from "@/types/game";

interface Body {
  count: number;
}

const ALLOWED_COUNTS = [1, 10];

/** Spends crystals on `count` gacha pulls, applying rewards (heroes, shards, gold, monster fragments). */
export const POST = withAuth(async (uid, request) => {
  const { count } = (await request.json()) as Body;
  if (!ALLOWED_COUNTS.includes(count)) throw new GameError("Nombre de tirages invalide");

  const userRef = adminDb.collection("users").doc(uid);
  const heroesRef = adminDb.collection("heroes");

  const resultPayload = await adminDb.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const user = userSnap.data() as UserProfile;
    const cost = count * GACHA_PULL_COST;
    if (user.crystals < cost) throw new GameError(`Cristaux insuffisants (${cost} requis)`);

    const heroesSnap = await tx.get(heroesRef.where("ownerId", "==", uid));
    const ownedSubclassIds = heroesSnap.docs.map((d) => (d.data() as Hero).subclassId);

    const seed = `${uid}:${Date.now()}:${Math.random()}`;
    const rng = createRng(seed);
    const { results, pity } = performPulls(
      rng,
      count,
      user.gachaPity,
      ownedSubclassIds,
      heroesSnap.size,
      MAX_HEROES,
    );

    let goldGained = 0;
    const shardsGained: Record<string, number> = {};
    const capturedGained: Record<string, number> = {};

    for (const result of results) {
      if (result.kind === "gold" && result.amount) {
        goldGained += result.amount;
      } else if (result.kind === "shards" && result.subclassId && result.amount) {
        shardsGained[result.subclassId] = (shardsGained[result.subclassId] ?? 0) + result.amount;
      } else if (result.kind === "monsterFragment" && result.monsterRefId) {
        capturedGained[result.monsterRefId] = (capturedGained[result.monsterRefId] ?? 0) + 1;
      }
    }

    const nextShards = { ...user.shards };
    for (const [subclassId, amount] of Object.entries(shardsGained)) {
      nextShards[subclassId] = (nextShards[subclassId] ?? 0) + amount;
    }
    const nextCaptured = { ...(user.capturedMonsters ?? {}) };
    for (const [monsterRefId, amount] of Object.entries(capturedGained)) {
      nextCaptured[monsterRefId] = (nextCaptured[monsterRefId] ?? 0) + amount;
    }

    tx.update(userRef, {
      crystals: user.crystals - cost,
      gold: user.gold + goldGained,
      shards: nextShards,
      capturedMonsters: nextCaptured,
      gachaPity: pity,
    });

    for (const result of results) {
      if (result.kind !== "hero" || !result.subclassId || !result.heroName) continue;
      const heroRef = heroesRef.doc();
      const role = getSubclass(result.subclassId).role;
      tx.set(heroRef, newHeroData(heroRef.id, uid, result.heroName, role, result.subclassId));
    }

    return { results, crystals: user.crystals - cost, gold: user.gold + goldGained };
  });

  return NextResponse.json(resultPayload);
});
