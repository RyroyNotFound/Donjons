import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { newHeroData } from "@/lib/game/heroFactory";
import { HERO_SLOTS_MAX_LEVEL, heroSlotsForLevel } from "@/lib/game/content/dungeonUpgrades";
import { heroSlotCost, MAX_HEROES } from "@/lib/game/economy";
import type { DungeonUpgrades, UserProfile } from "@/types/game";

/** Recruits a new blank hero. With no free slot, first buys one with gold (heroSlotCost), up to MAX_HEROES. */
export const POST = withAuth(async (uid) => {
  const heroRef = adminDb.collection("heroes").doc();
  const userRef = adminDb.collection("users").doc(uid);
  const upgradesRef = adminDb.collection("dungeonUpgrades").doc(uid);

  const goldSpent = await adminDb.runTransaction(async (tx) => {
    const [userSnap, upgradesSnap, heroesSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(upgradesRef),
      tx.get(adminDb.collection("heroes").where("ownerId", "==", uid)),
    ]);

    const user = userSnap.data() as UserProfile;
    const heroSlotsLevel = (upgradesSnap.data() as DungeonUpgrades | undefined)?.levels.heroSlots ?? 0;
    const slots = Math.min(MAX_HEROES, heroSlotsForLevel(heroSlotsLevel));
    let cost = 0;
    if (heroesSnap.size >= slots) {
      if (slots >= MAX_HEROES || heroSlotsLevel >= HERO_SLOTS_MAX_LEVEL) {
        throw new GameError(`Nombre maximum de héros atteint (${MAX_HEROES})`);
      }
      cost = heroSlotCost(heroSlotsLevel);
      if (user.gold < cost) throw new GameError(`Or insuffisant : ${cost} requis pour un nouvel emplacement`);
      tx.update(userRef, { gold: user.gold - cost });
      tx.set(upgradesRef, { ownerId: uid, levels: { heroSlots: heroSlotsLevel + 1 }, updatedAt: Date.now() }, { merge: true });
    }

    tx.set(heroRef, newHeroData(heroRef.id, uid, "Recrue"));
    return cost;
  });

  return NextResponse.json({ heroId: heroRef.id, goldSpent });
});
