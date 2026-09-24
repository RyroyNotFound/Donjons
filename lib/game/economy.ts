// Client-safe pricing formulas (no server-only imports) so both API routes
// and UI pages can compute the same numbers without duplicating them.

export const MAX_HEROES = 12;
/** Gold price of the next hero roster slot, from the current heroSlots level (150, 225, 338...). */
export function heroSlotCost(currentLevel: number): number {
  return Math.round(150 * Math.pow(1.5, currentLevel));
}
export const MAX_STAR_RANK = 5;
export const STARTING_CRYSTALS = 15;

// Talents aren't slot-limited (gated by tree tier/prereqs/ownership instead).
export const SPELL_SLOTS = 2;
export const MASTERY_SLOTS = 3;

/** Cost to raise a hero from `currentStar` to `currentStar + 1`. */
export function rankUpCost(currentStar: number): { rankTokens: number; gold: number } {
  return { rankTokens: currentStar * 3, gold: currentStar * 100 };
}

/** Highest level a hero can reach at a given star rank (raises with each star). */
export function levelCapForStar(star: number): number {
  return 10 + star * 10;
}

/** Flat multiplicative stat bonus from star rank (+8% per star above 1). */
export function starRankStatMultiplier(star: number): number {
  return 1 + Math.max(0, star - 1) * 0.08;
}

/** Highest rank a spell/talent/mastery can reach — further gacha duplicates convert to rank tokens instead. */
export const MAX_COMPONENT_RANK = 5;

/** Flat multiplicative bonus to a spell/talent/mastery's effect from its rank (+8% per rank above 1) —
 *  duplicates raise this instead of just converting to currency, mirroring star rank. */
export function componentRankMultiplier(rank: number): number {
  return 1 + Math.max(0, rank - 1) * 0.08;
}
