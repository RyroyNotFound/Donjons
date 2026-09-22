import { NextResponse } from "next/server";
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

/** Equips (or unequips, when itemId is null) an item into one of a hero's slots. */
export const POST = withAuth<RouteContext>(async (uid, request, { params }) => {
  const { id: heroId } = await params;
  const { slot, itemId } = (await request.json()) as Body;

  const heroRef = adminDb.collection("heroes").doc(heroId);

  await adminDb.runTransaction(async (tx) => {
    const heroSnap = await tx.get(heroRef);
    if (!heroSnap.exists) throw new GameError("Héros introuvable");
    const hero = heroSnap.data() as Hero;
    if (hero.ownerId !== uid) throw new GameError("Ce héros ne vous appartient pas");

    const previousItemId = hero.equipment[slot];
    if (previousItemId) {
      tx.update(adminDb.collection("items").doc(previousItemId), {
        equippedByHeroId: null,
      });
    }

    if (itemId) {
      const itemRef = adminDb.collection("items").doc(itemId);
      const itemSnap = await tx.get(itemRef);
      if (!itemSnap.exists) throw new GameError("Objet introuvable");
      const item = itemSnap.data() as Item;
      if (item.ownerId !== uid) throw new GameError("Cet objet ne vous appartient pas");
      if (item.slot !== slot) throw new GameError("Cet objet ne va pas dans cet emplacement");
      if (item.equippedByHeroId && item.equippedByHeroId !== heroId) {
        tx.update(adminDb.collection("heroes").doc(item.equippedByHeroId), {
          [`equipment.${slot}`]: null,
        });
      }
      tx.update(itemRef, { equippedByHeroId: heroId });
    }

    tx.update(heroRef, { [`equipment.${slot}`]: itemId ?? null });
  });

  return NextResponse.json({ ok: true });
});
