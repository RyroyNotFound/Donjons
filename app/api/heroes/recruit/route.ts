import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { newHeroData } from "@/lib/game/heroFactory";
import { heroSlotsForLevel } from "@/lib/game/content/dungeonUpgrades";
import { MAX_HEROES } from "@/lib/game/economy";
import type { DungeonUpgrades } from "@/types/game";

/** Recruits a new blank hero, up to the roster cap unlocked by the "heroSlots" dungeon upgrade track. */
export const POST = withAuth(async (uid) => {
  const heroRef = adminDb.collection("heroes").doc();

  await adminDb.runTransaction(async (tx) => {
    const [upgradesSnap, heroesSnap] = await Promise.all([
      tx.get(adminDb.collection("dungeonUpgrades").doc(uid)),
      tx.get(adminDb.collection("heroes").where("ownerId", "==", uid)),
    ]);

    const heroSlotsLevel = (upgradesSnap.data() as DungeonUpgrades | undefined)?.levels.heroSlots ?? 0;
    const slots = Math.min(MAX_HEROES, heroSlotsForLevel(heroSlotsLevel));
    if (heroesSnap.size >= slots) {
      throw new GameError(`Aucun emplacement libre (${heroesSnap.size}/${slots}) — améliorez "Antre des héros"`);
    }

    tx.set(heroRef, newHeroData(heroRef.id, uid, "Recrue"));
  });

  return NextResponse.json({ heroId: heroRef.id });
});
