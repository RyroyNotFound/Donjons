import { NextResponse } from "next/server";
import type { DocumentReference } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import type { Hero, Item, ItemSlot } from "@/types/game";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface Body {
  slot: ItemSlot;
  itemId: string | null;
}

const SLOTS: readonly ItemSlot[] = ["weapon", "armor", "trinket"];

/** Equips (or unequips, when itemId is null) an item into one of a hero's slots. */
export const POST = withAuth<RouteContext>(async (uid, request, { params }) => {
  const { id: heroId } = await params;
  const { slot, itemId } = (await request.json()) as Body;
  if (!SLOTS.includes(slot)) throw new GameError("Emplacement invalide");

  const heroRef = adminDb.collection("heroes").doc(heroId);

  await adminDb.runTransaction(async (tx) => {
    // Firestore transactions require every read before the first write.
    const heroSnap = await tx.get(heroRef);
    if (!heroSnap.exists) throw new GameError("Héros introuvable");
    const hero = heroSnap.data() as Hero;
    if (hero.ownerId !== uid) throw new GameError("Ce héros ne vous appartient pas");

    let itemRef: DocumentReference | null = null;
    let otherHeroRef: DocumentReference | null = null;
    if (itemId) {
      itemRef = adminDb.collection("items").doc(itemId);
      const itemSnap = await tx.get(itemRef);
      if (!itemSnap.exists) throw new GameError("Objet introuvable");
      const item = itemSnap.data() as Item;
      if (item.ownerId !== uid) throw new GameError("Cet objet ne vous appartient pas");
      if (item.slot !== slot) throw new GameError("Cet objet ne va pas dans cet emplacement");
      if (item.equippedByHeroId && item.equippedByHeroId !== heroId) {
        const ref = adminDb.collection("heroes").doc(item.equippedByHeroId);
        // The previous wearer may have been deleted (legacy reset): only
        // clear its slot if it still exists.
        if ((await tx.get(ref)).exists) otherHeroRef = ref;
      }
    }

    const previousItemId = hero.equipment[slot];
    if (previousItemId && previousItemId !== itemId) {
      tx.update(adminDb.collection("items").doc(previousItemId), {
        equippedByHeroId: null,
      });
    }
    if (otherHeroRef) tx.update(otherHeroRef, { [`equipment.${slot}`]: null });
    if (itemRef) tx.update(itemRef, { equippedByHeroId: heroId });
    tx.update(heroRef, { [`equipment.${slot}`]: itemId ?? null });
  });

  return NextResponse.json({ ok: true });
});
