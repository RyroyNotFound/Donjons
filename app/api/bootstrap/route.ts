import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/api/handler";
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
        createdAt: Date.now(),
      };
      await userRef.set(profile);

      const batch = adminDb.batch();
      for (const starter of STARTER_HEROES) {
        const heroRef = adminDb.collection("heroes").doc();
        const hero: Hero = {
          id: heroRef.id,
          ownerId: uid,
          name: starter.name,
          role: starter.role,
          subclassId: starter.subclassId,
          level: 1,
          xp: 0,
          talentPoints: 0,
          talents: {},
          equipment: {},
          status: "idle",
          createdAt: Date.now(),
        };
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
