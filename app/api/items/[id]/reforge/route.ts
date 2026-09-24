import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getOwnedItemInTx } from "@/lib/game/itemLoader";
import { itemDisplayName, reforgeCost, rollAffixes } from "@/lib/game/engine/items";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Rerolls all of an item's affixes (same count, new lines and values). Base stats, rarity and
 *  enhancement level are kept. */
export const POST = withAuth<RouteContext>(async (uid, _request, { params }) => {
  const { id: itemId } = await params;

  const item = await adminDb.runTransaction(async (tx) => {
    const { item, itemRef, user, userRef } = await getOwnedItemInTx(tx, uid, itemId);
    const currentAffixes = item.affixes ?? [];
    if (currentAffixes.length === 0) throw new GameError("Cet objet n'a aucun affixe à réforger");

    const cost = reforgeCost(item);
    const shards = user.forgeShards ?? 0;
    if (user.gold < cost.gold) throw new GameError("Or insuffisant");
    if (shards < cost.shards) throw new GameError(`Éclats de forge insuffisants (${cost.shards} requis)`);

    const baseName = item.baseName ?? item.name;
    const affixes = rollAffixes(Math.random, item.slot, item.tier ?? 1, currentAffixes.length);
    const name = itemDisplayName(baseName, affixes);

    tx.update(userRef, { gold: user.gold - cost.gold, forgeShards: shards - cost.shards });
    tx.update(itemRef, { affixes, name, baseName });
    return { ...item, affixes, name };
  });

  return NextResponse.json({ item });
});
