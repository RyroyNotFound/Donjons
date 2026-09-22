import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/api/handler";
import { newHeroData } from "@/lib/game/heroFactory";
import { STARTING_CRYSTALS } from "@/lib/game/economy";
import type { Hero, UserProfile } from "@/types/game";

const STARTER_HEROES: { name: string; role: Hero["role"]; subclassId: string }[] = [
  { name: "Argos", role: "DPS", subclassId: "guerrier" },
  { name: "Elyne", role: "HEAL", subclassId: "pretre" },
  { name: "Bram", role: "TANK", subclassId: "paladin" },
];

const STARTING_GOLD = 100;

/** Ensures a user profile + starter roster exist, creating them on first login. Idempotent. */
export const POST = withAuth(async (uid) => {
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      const profile: UserProfile = {
        uid,
        displayName: `Aventurier-${uid.slice(0, 5)}`,
        gold: STARTING_GOLD,
        resources: { wood: 0, ore: 0, essence: 0 },
        capturedMonsters: {},
        crystals: STARTING_CRYSTALS,
        shards: {},
        gachaPity: {
          totalPulls: 0,
          pullsSinceRare: 0,
          pullsSinceEpique: 0,
          pullsSinceLegendaire: 0,
        },
        createdAt: Date.now(),
      };
      await userRef.set(profile);

      const batch = adminDb.batch();
      for (const starter of STARTER_HEROES) {
        const heroRef = adminDb.collection("heroes").doc();
        const hero = newHeroData(heroRef.id, uid, starter.name, starter.role, starter.subclassId);
        batch.set(heroRef, hero);
      }

      const dungeonRef = adminDb.collection("dungeons").doc(uid);
      batch.set(dungeonRef, {
        ownerId: uid,
        rooms: [
          { slot: 1, kind: "empty" },
          { slot: 2, kind: "empty" },
          { slot: 3, kind: "empty" },
        ],
        pointsSpent: 0,
        updatedAt: Date.now(),
      });

      await batch.commit();
    } else {
      // Backfill fields added after this profile was first created.
      const existing = userSnap.data() as Partial<UserProfile>;
      const patch: Partial<UserProfile> = {};
      if (existing.crystals === undefined) patch.crystals = STARTING_CRYSTALS;
      if (existing.shards === undefined) patch.shards = {};
      if (existing.gachaPity === undefined) {
        patch.gachaPity = {
          totalPulls: 0,
          pullsSinceRare: 0,
          pullsSinceEpique: 0,
          pullsSinceLegendaire: 0,
        };
      }
      if (existing.capturedMonsters === undefined) patch.capturedMonsters = {};
      if (Object.keys(patch).length > 0) await userRef.update(patch);

      const heroesSnap = await adminDb.collection("heroes").where("ownerId", "==", uid).get();
      const heroBatch = adminDb.batch();
      let heroPatches = 0;
      for (const doc of heroesSnap.docs) {
        const hero = doc.data() as Partial<Hero>;
        if (hero.starRank === undefined) {
          heroBatch.update(doc.ref, { starRank: 1 });
          heroPatches++;
        }
      }
      if (heroPatches > 0) await heroBatch.commit();
    }

    const [profileSnap, heroesSnap] = await Promise.all([
      userRef.get(),
      adminDb.collection("heroes").where("ownerId", "==", uid).get(),
    ]);

    return NextResponse.json({
      profile: profileSnap.data(),
      heroes: heroesSnap.docs.map((d) => d.data()),
    });
});
