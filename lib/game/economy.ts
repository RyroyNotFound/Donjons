// Client-safe pricing formulas (no server-only imports) so both API routes
// and UI pages can compute the same numbers without duplicating them.

export const MAX_HEROES = 12;
export const MAX_STAR_RANK = 5;
export const STARTING_CRYSTALS = 15;

/** Cost to raise a hero from `currentStar` to `currentStar + 1`. */
export function starUpCost(currentStar: number): { shards: number; gold: number } {
  return { shards: currentStar * 3, gold: currentStar * 100 };
}

/** Highest level a hero can reach at a given star rank (raises with each star). */
export function levelCapForStar(star: number): number {
  return 10 + star * 10;
}

/** Flat multiplicative stat bonus from star rank (+8% per star above 1). */
export function starRankStatMultiplier(star: number): number {
  return 1 + Math.max(0, star - 1) * 0.08;
}
