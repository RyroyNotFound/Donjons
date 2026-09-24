import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getOwnedItemInTx } from "@/lib/game/itemLoader";
import { salvageYield } from "@/lib/game/engine/items";
import type { ResourceKind } from "@/types/game";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Destroys an unequipped item in exchange for forge shards + some crafting resources. */
export const POST = withAuth<RouteContext>(async (uid, _request, { params }) => {
  const { id: itemId } = await params;

  const gained = await adminDb.runTransaction(async (tx) => {
    const { item, itemRef, user, userRef } = await getOwnedItemInTx(tx, uid, itemId);
    if (item.equippedByHeroId) throw new GameError("Déséquipez cet objet avant de le recycler");

    const gained = salvageYield(item);
    const nextResources = { ...user.resources };
    for (const [kind, amount] of Object.entries(gained.resources) as [ResourceKind, number][]) {
      nextResources[kind] = (nextResources[kind] ?? 0) + amount;
    }
    tx.update(userRef, { forgeShards: (user.forgeShards ?? 0) + gained.shards, resources: nextResources });
    tx.delete(itemRef);
    return gained;
  });

  return NextResponse.json(gained);
});
