import type { Hero } from "@/types/game";

/** The shape of a brand-new level-1 hero, everywhere one gets created (starter roster, recruitment...).
 *  Classless by default — the player assigns a class from their unlocked-components pool afterwards. */
export function newHeroData(id: string, ownerId: string, name: string): Hero {
  return {
    id,
    ownerId,
    name,
    // classId intentionally omitted (not set to undefined — Firestore's admin SDK
    // rejects `undefined` field values outright): a classless hero has no key at all.
    level: 1,
    xp: 0,
    starRank: 1,
    talentPoints: 0,
    talents: {},
    equippedSpellIds: [],
    equippedMasteryIds: [],
    equipment: {},
    builds: [],
    status: "idle",
    createdAt: Date.now(),
  };
}
