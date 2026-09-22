import type { Hero, Role } from "@/types/game";

/** The shape of a brand-new level-1 hero, everywhere one gets created (starter roster, recruitment...). */
export function newHeroData(
  id: string,
  ownerId: string,
  name: string,
  role: Role,
  subclassId: string,
): Hero {
  return {
    id,
    ownerId,
    name,
    role,
    subclassId,
    level: 1,
    xp: 0,
    starRank: 1,
    talentPoints: 0,
    talents: {},
    equipment: {},
    status: "idle",
    createdAt: Date.now(),
  };
}
