import { MAX_COMPONENT_RANK } from "@/lib/game/economy";
import type { GachaRarity } from "@/types/game";

// The Observatoire: a "spark" shop (like Granblue Fantasy's spark or Genshin's Starglitter
// exchange) that turns the stardust every gacha pull leaves behind into a chosen reward. It never
// touches the gacha odds — it's bad-luck protection: whatever the dice say, steady pulling always
// ends up completing a build. Unlocking something you don't own yet is deliberately pricey (the
// gacha stays the exciting way to discover things); ranking up something you already own is
// cheaper, so duplicates you're missing never become a hard wall.

/** Stardust granted by every pull, on top of its reward. */
export const STARDUST_PER_PULL: Record<GachaRarity, number> = { commun: 1, rare: 2, epique: 5, legendaire: 12 };
/** A pull landing on something already maxed also gives this many times its stardust. */
export const MAXED_DUPLICATE_STARDUST_MULTIPLIER = 2;

export type ObservatoryKind = "class" | "spell" | "talent" | "mastery";

/** Stardust price to unlock a chosen, not-yet-owned element. */
export const UNLOCK_PRICE: Record<ObservatoryKind, number> = {
  mastery: 400,
  spell: 800,
  talent: 1800,
  class: 6000,
};

/** Stardust price to raise an owned spell/talent/mastery by one rank (classes have no rank). */
export const RANK_UP_PRICE: Record<Exclude<ObservatoryKind, "class">, number> = {
  mastery: 80,
  spell: 140,
  talent: 220,
};

/** Rank tokens (star-ups) can also be bought, in packs. */
export const RANK_TOKEN_PACK = { amount: 5, price: 60 };

/** Price of the next Observatoire step for an element at `currentRank` (0 = not owned), or null if maxed. */
export function observatoryPrice(kind: ObservatoryKind, currentRank: number): number | null {
  if (currentRank <= 0) return UNLOCK_PRICE[kind];
  if (kind === "class" || currentRank >= MAX_COMPONENT_RANK) return null;
  return RANK_UP_PRICE[kind];
}
