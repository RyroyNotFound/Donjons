import type { GachaRarity } from "@/types/game";

export const GACHA_PULL_COST = 1;

export const RARITY_WEIGHTS: Record<GachaRarity, number> = {
  commun: 0.7,
  rare: 0.22,
  epique: 0.07,
  legendaire: 0.01,
};

// Pity: guarantees a floor rarity if you've gone this many pulls without one.
export const PITY_RARE_THRESHOLD = 10;
export const PITY_EPIQUE_THRESHOLD = 30;
export const PITY_LEGENDAIRE_THRESHOLD = 60;
