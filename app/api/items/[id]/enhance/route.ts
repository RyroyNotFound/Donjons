import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getOwnedItemInTx } from "@/lib/game/itemLoader";
import { enhanceCost, MAX_ENHANCE_LEVEL } from "@/lib/game/engine/items";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Tries to raise an item's enhancement level by one. Past +5 it can fail: the cost is still paid,
 *  but the item keeps its level. Works on equipped items too. */
export const POST = withAuth<RouteContext>(async (uid, _request, { params }) => {
  const { id: itemId } = await params;

  const result = await adminDb.runTransaction(async (tx) => {
    const { item, itemRef, user, userRef } = await getOwnedItemInTx(tx, uid, itemId);
    const level = item.enhanceLevel ?? 0;
    if (level >= MAX_ENHANCE_LEVEL) throw new GameError("Amélioration maximale atteinte");

    const cost = enhanceCost(item);
    const shards = user.forgeShards ?? 0;
    if (user.gold < cost.gold) throw new GameError("Or insuffisant");
    if (shards < cost.shards) throw new GameError(`Éclats de forge insuffisants (${cost.shards} requis)`);

    const success = Math.random() < cost.successChance;
    tx.update(userRef, { gold: user.gold - cost.gold, forgeShards: shards - cost.shards });
    if (success) tx.update(itemRef, { enhanceLevel: level + 1 });
    return { success, enhanceLevel: success ? level + 1 : level };
  });

  return NextResponse.json(result);
});
