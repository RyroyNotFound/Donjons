import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { performPulls } from "@/lib/game/engine/gacha";
import { createRng } from "@/lib/game/engine/rng";
import { GACHA_PULL_COST } from "@/lib/game/content/gacha";
import type { UserProfile } from "@/types/game";

interface Body {
  count: number;
}

const ALLOWED_COUNTS = [1, 10];

/** Spends crystals on `count` gacha pulls, applying rewards (classes, spells, talents, masteries, gold, rank tokens, monster fragments). */
export const POST = withAuth(async (uid, request) => {
  const { count } = (await request.json()) as Body;
  if (!ALLOWED_COUNTS.includes(count)) throw new GameError("Nombre de tirages invalide");

  const userRef = adminDb.collection("users").doc(uid);

  const resultPayload = await adminDb.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const user = userSnap.data() as UserProfile;
    const cost = count * GACHA_PULL_COST;
    if (user.crystals < cost) throw new GameError(`Cristaux insuffisants (${cost} requis)`);

    const seed = `${uid}:${Date.now()}:${Math.random()}`;
    const rng = createRng(seed);
    const { results, pity } = performPulls(
      rng,
      count,
      user.gachaPity,
      user.unlockedClasses,
      user.componentRanks,
    );

    let goldGained = 0;
    let rankTokensGained = 0;
    const capturedGained: Record<string, number> = {};
    const unlockedClasses = [...user.unlockedClasses];
    const componentRanks = { ...user.componentRanks };

    for (const result of results) {
      if (result.kind === "gold" && result.amount) {
        goldGained += result.amount;
      } else if (result.kind === "rankToken" && result.amount) {
        rankTokensGained += result.amount;
      } else if (result.kind === "monsterFragment" && result.monsterRefId) {
        capturedGained[result.monsterRefId] = (capturedGained[result.monsterRefId] ?? 0) + 1;
      } else if (result.kind === "class" && result.refId) {
        unlockedClasses.push(result.refId);
      } else if (result.refId) {
        componentRanks[result.refId] = (componentRanks[result.refId] ?? 0) + 1;
      }
    }

    const nextCaptured = { ...(user.capturedMonsters ?? {}) };
    for (const [monsterRefId, amount] of Object.entries(capturedGained)) {
      nextCaptured[monsterRefId] = (nextCaptured[monsterRefId] ?? 0) + amount;
    }

    tx.update(userRef, {
      crystals: user.crystals - cost,
      gold: user.gold + goldGained,
      rankTokens: user.rankTokens + rankTokensGained,
      unlockedClasses,
      componentRanks,
      capturedMonsters: nextCaptured,
      gachaPity: pity,
    });

    return {
      results,
      crystals: user.crystals - cost,
      gold: user.gold + goldGained,
      rankTokens: user.rankTokens + rankTokensGained,
    };
  });

  return NextResponse.json(resultPayload);
});
