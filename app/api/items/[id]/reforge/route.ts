import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getOwnedItemInTx } from "@/lib/game/itemLoader";
import { itemDisplayName, reforgeCost, rollAffixes } from "@/lib/game/engine/items";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface Body {
  /** Index of the one affix line to reroll; the others stay locked. Absent = reroll every line
   *  (what the forge did before targeted rerolls existed). */
  affixIndex?: number;
}

/** Rerolls one of an item's affix lines (Diablo-style enchanting: the other lines are kept and
 *  can't come back as the new one). Base stats, rarity and enhancement level never change. */
export const POST = withAuth<RouteContext>(async (uid, request, { params }) => {
  const { id: itemId } = await params;
  const { affixIndex } = ((await request.json().catch(() => ({}))) ?? {}) as Body;

  const item = await adminDb.runTransaction(async (tx) => {
    const { item, itemRef, user, userRef } = await getOwnedItemInTx(tx, uid, itemId);
    const currentAffixes = item.affixes ?? [];
    if (currentAffixes.length === 0) throw new GameError("Cet objet n'a aucun affixe à réforger");

    const cost = reforgeCost(item);
    const shards = user.forgeShards ?? 0;
    if (user.gold < cost.gold) throw new GameError("Or insuffisant");
    if (shards < cost.shards) throw new GameError(`Éclats de forge insuffisants (${cost.shards} requis)`);

    const baseName = item.baseName ?? item.name;
    let affixes;
    if (affixIndex === undefined) {
      affixes = rollAffixes(Math.random, item.slot, item.tier ?? 1, currentAffixes.length);
    } else {
      if (!Number.isInteger(affixIndex) || affixIndex < 0 || affixIndex >= currentAffixes.length) {
        throw new GameError("Ligne d'affixe inconnue");
      }
      const locked = currentAffixes.filter((_, i) => i !== affixIndex).map((a) => a.affixId);
      const [rolled] = rollAffixes(Math.random, item.slot, item.tier ?? 1, 1, locked);
      if (!rolled) throw new GameError("Aucun autre affixe possible pour cet objet");
      affixes = currentAffixes.map((a, i) => (i === affixIndex ? rolled : a));
    }
    const name = itemDisplayName(baseName, affixes);

    tx.update(userRef, { gold: user.gold - cost.gold, forgeShards: shards - cost.shards });
    tx.update(itemRef, { affixes, name, baseName });
    return { ...item, affixes, name };
  });

  return NextResponse.json({ item });
});
