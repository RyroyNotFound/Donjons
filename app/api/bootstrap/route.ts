import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/api/handler";
import { newHeroData } from "@/lib/game/heroFactory";
import { STARTING_CRYSTALS } from "@/lib/game/economy";
import { ENTRANCE_CELL } from "@/lib/game/content/dungeon";
import type { Dungeon, DungeonUpgrades, Hero, UserProfile } from "@/types/game";

const DEFAULT_UPGRADE_LEVELS: DungeonUpgrades["levels"] = {
  expansion: 0,
  architecture: 0,
  defenderVigor: 0,
  trapcraft: 0,
  beastMastery: 0,
  hazardDensity: 0,
  vaultCapacity: 0,
  heroSlots: 0,
};

const STARTING_GOLD = 100;

const EMPTY_GACHA_PITY = {
  totalPulls: 0,
  pullsSinceRare: 0,
  pullsSinceEpique: 0,
  pullsSinceLegendaire: 0,
};

function freshProfile(uid: string): UserProfile {
  return {
    uid,
    displayName: `Aventurier-${uid.slice(0, 5)}`,
    gold: STARTING_GOLD,
    resources: { wood: 0, ore: 0, essence: 0 },
    capturedMonsters: {},
    crystals: STARTING_CRYSTALS,
    rankTokens: 0,
    unlockedClasses: [],
    componentRanks: {},
    gachaPity: { ...EMPTY_GACHA_PITY },
    createdAt: Date.now(),
  };
}

function freshDungeon(uid: string): Dungeon {
  return {
    ownerId: uid,
    rooms: [{ ...ENTRANCE_CELL, type: "empty" }],
    garrisonHeroIds: [],
    roomCount: 0,
    treasureRoomCount: 0,
    pointsSpent: 0,
    updatedAt: Date.now(),
  };
}

/** Ensures a user profile + starter roster exist, creating them on first login. Idempotent. */
export const POST = withAuth(async (uid) => {
  const userRef = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    await userRef.set(freshProfile(uid));

    const batch = adminDb.batch();
    const heroRef = adminDb.collection("heroes").doc();
    batch.set(heroRef, newHeroData(heroRef.id, uid, "Recrue"));
    batch.set(adminDb.collection("dungeons").doc(uid), freshDungeon(uid));
    batch.set(adminDb.collection("dungeonUpgrades").doc(uid), {
      ownerId: uid,
      levels: DEFAULT_UPGRADE_LEVELS,
      updatedAt: Date.now(),
    } satisfies DungeonUpgrades);
    await batch.commit();
  } else {
    const existing = userSnap.data() as Partial<UserProfile> & Record<string, unknown>;

    // The hero/gacha system has been rebuilt twice (2026-09-23): first around
    // gacha-unlocked components instead of fixed-subclass heroes, then again to
    // add per-component gacha-duplicate ranks (`componentRanks`) instead of a
    // flat owned/not-owned list (`unlockedComponents`). Accounts from either
    // earlier shape can't be migrated meaningfully (chosen reset, not a lossy
    // best-effort conversion), so wipe and reseed.
    const isLegacyShape = existing.componentRanks === undefined;

    if (isLegacyShape) {
      const heroesSnap = await adminDb.collection("heroes").where("ownerId", "==", uid).get();
      const batch = adminDb.batch();
      for (const doc of heroesSnap.docs) batch.delete(doc.ref);

      const heroRef = adminDb.collection("heroes").doc();
      batch.set(heroRef, newHeroData(heroRef.id, uid, "Recrue"));
      batch.set(adminDb.collection("dungeons").doc(uid), freshDungeon(uid));
      batch.set(userRef, {
        ...freshProfile(uid),
        gold: existing.gold ?? STARTING_GOLD,
        resources: existing.resources ?? { wood: 0, ore: 0, essence: 0 },
        crystals: existing.crystals ?? STARTING_CRYSTALS,
        gachaPity: existing.gachaPity ?? { ...EMPTY_GACHA_PITY },
        createdAt: existing.createdAt ?? Date.now(),
      } satisfies UserProfile);
      await batch.commit();
    } else {
      // Backfill fields added after this profile was first created.
      const patch: Partial<UserProfile> = {};
      if (existing.capturedMonsters === undefined) patch.capturedMonsters = {};
      if (Object.keys(patch).length > 0) await userRef.update(patch);
    }

    const [dungeonSnap, upgradesSnap] = await Promise.all([
      adminDb.collection("dungeons").doc(uid).get(),
      adminDb.collection("dungeonUpgrades").doc(uid).get(),
    ]);
    const existingDungeon = dungeonSnap.data() as Partial<Dungeon> | undefined;
    if (!isLegacyShape && (!existingDungeon || existingDungeon.garrisonHeroIds === undefined)) {
      await adminDb.collection("dungeons").doc(uid).set(freshDungeon(uid));
    }
    if (!upgradesSnap.exists) {
      const upgrades: DungeonUpgrades = { ownerId: uid, levels: DEFAULT_UPGRADE_LEVELS, updatedAt: Date.now() };
      await adminDb.collection("dungeonUpgrades").doc(uid).set(upgrades);
    } else {
      const levels = (upgradesSnap.data() as DungeonUpgrades).levels as Partial<DungeonUpgrades["levels"]>;
      if (levels.heroSlots === undefined) {
        await adminDb.collection("dungeonUpgrades").doc(uid).update({ "levels.heroSlots": 0 });
      }
    }
  }

  const [profileSnap, initialHeroesSnap] = await Promise.all([
    userRef.get(),
    adminDb.collection("heroes").where("ownerId", "==", uid).get(),
  ]);

  // Safety net: a profile can legitimately exist with zero heroes only if hero
  // creation above failed partway (e.g. a past bug) — never a valid end state.
  let heroesSnap = initialHeroesSnap;
  if (heroesSnap.empty) {
    const heroRef = adminDb.collection("heroes").doc();
    await heroRef.set(newHeroData(heroRef.id, uid, "Recrue"));
    heroesSnap = await adminDb.collection("heroes").where("ownerId", "==", uid).get();
  }

  return NextResponse.json({
    profile: profileSnap.data(),
    heroes: heroesSnap.docs.map((d) => d.data()) as Hero[],
  });
});
