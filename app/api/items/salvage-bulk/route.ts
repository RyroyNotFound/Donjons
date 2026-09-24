import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { bulkSalvageable, ITEM_RARITIES, salvageYield } from "@/lib/game/engine/items";
import type { Item, ItemRarity, ResourceKind, UserProfile } from "@/types/game";

interface Body {
  rarity: ItemRarity;
}

/** Firestore caps a transaction at 500 writes: one per deleted item + the profile update. */
const MAX_PER_CALL = 450;

/** Recycles every unequipped, non-enhanced item of one rarity at once (see bulkSalvageable). */
export const POST = withAuth(async (uid, request) => {
  const { rarity } = (await request.json()) as Body;
  if (!ITEM_RARITIES.includes(rarity)) throw new GameError("Rareté inconnue");

  const userRef = adminDb.collection("users").doc(uid);
  const query = adminDb.collection("items").where("ownerId", "==", uid).where("rarity", "==", rarity);

  const result = await adminDb.runTransaction(async (tx) => {
    const [itemsSnap, userSnap] = await Promise.all([tx.get(query), tx.get(userRef)]);
    const user = userSnap.data() as UserProfile;
    const targets = itemsSnap.docs.filter((d) => bulkSalvageable(d.data() as Item)).slice(0, MAX_PER_CALL);
    if (targets.length === 0) throw new GameError("Aucun objet à recycler dans cette rareté");

    let shards = 0;
    const resources: Partial<Record<ResourceKind, number>> = {};
    for (const doc of targets) {
      const gained = salvageYield(doc.data() as Item);
      shards += gained.shards;
      for (const [kind, amount] of Object.entries(gained.resources) as [ResourceKind, number][]) {
        resources[kind] = (resources[kind] ?? 0) + amount;
      }
      tx.delete(doc.ref);
    }
    const nextResources = { ...user.resources };
    for (const [kind, amount] of Object.entries(resources) as [ResourceKind, number][]) {
      nextResources[kind] = (nextResources[kind] ?? 0) + amount;
    }
    tx.update(userRef, { forgeShards: (user.forgeShards ?? 0) + shards, resources: nextResources });
    return { count: targets.length, shards, resources };
  });

  return NextResponse.json(result);
});
