// Client-safe item rules (rolling, enhancement, reforge, salvage) shared by API routes and UI pages.

import { affixesForSlot, getAffix } from "@/lib/game/content/affixes";
import { randomInt } from "@/lib/game/engine/rng";
import { isPercentStat, STAT_KEYS } from "@/lib/game/engine/elements";
import type { HeroStats, Item, ItemAffix, ItemRarity, ItemSlot, ResourceKind } from "@/types/game";

export const ITEM_RARITIES: ItemRarity[] = ["commun", "rare", "epique", "legendaire"];

/** Multiplier on an item's base stats from its rarity. */
const RARITY_BASE_MULTIPLIER: Record<ItemRarity, number> = {
  commun: 1,
  rare: 1.2,
  epique: 1.45,
  legendaire: 1.75,
};

/** Number of random affixes an item rolls, by rarity. */
export const AFFIX_COUNT: Record<ItemRarity, number> = {
  commun: 0,
  rare: 1,
  epique: 2,
  legendaire: 3,
};

/** Highest item tier: 1..3 from forge recipes and normal zones, 4..5 from harder difficulties. */
export const MAX_ITEM_TIER = 5;

/** Affix value multiplier by item tier (index = tier). % stats use half the extra (see affixScale). */
const TIER_AFFIX_SCALE = [1, 1, 1.6, 2.4, 3.3, 4.4];

function affixScale(stat: keyof HeroStats, tier: number): number {
  const scale = TIER_AFFIX_SCALE[tier];
  return isPercentStat(stat) ? 1 + (scale - 1) / 2 : scale;
}

/** Crafting rarity odds (weights) by recipe tier. */
export const CRAFT_RARITY_WEIGHTS: Record<number, Record<ItemRarity, number>> = {
  1: { commun: 70, rare: 25, epique: 5, legendaire: 0 },
  2: { commun: 45, rare: 38, epique: 14, legendaire: 3 },
  3: { commun: 20, rare: 45, epique: 27, legendaire: 8 },
};

export const MAX_ENHANCE_LEVEL = 10;
/** Each enhancement level multiplies the item's positive stats by this much more. */
export const ENHANCE_BONUS_PER_LEVEL = 0.15;


function rarityIndex(rarity: ItemRarity): number {
  return ITEM_RARITIES.indexOf(rarity);
}

function clampTier(tier: number | undefined): number {
  return Math.min(MAX_ITEM_TIER, Math.max(1, tier ?? 1));
}

export function rollRarity(rng: () => number, weights: Record<ItemRarity, number>): ItemRarity {
  const total = ITEM_RARITIES.reduce((sum, r) => sum + weights[r], 0);
  let roll = rng() * total;
  for (const rarity of ITEM_RARITIES) {
    roll -= weights[rarity];
    if (roll < 0) return rarity;
  }
  return "commun";
}

/** Rolls `count` distinct affixes valid for `slot`, skipping `excludeIds`. */
export function rollAffixes(
  rng: () => number,
  slot: ItemSlot,
  tier: number,
  count: number,
  excludeIds: string[] = [],
): ItemAffix[] {
  const pool = affixesForSlot(slot).filter((a) => !excludeIds.includes(a.id));
  const clamped = clampTier(tier);
  const rolled: ItemAffix[] = [];
  while (rolled.length < count && pool.length > 0) {
    const [affix] = pool.splice(randomInt(rng, 0, pool.length - 1), 1);
    const statBonus: Partial<HeroStats> = {};
    for (const [stat, [min, max]] of Object.entries(affix.statRanges) as [keyof HeroStats, [number, number]][]) {
      const value = Math.round(randomInt(rng, min, max) * affixScale(stat, clamped));
      if (value !== 0) statBonus[stat] = value;
    }
    rolled.push({ affixId: affix.id, statBonus });
  }
  return rolled;
}

function scaleStats(stats: Partial<HeroStats>, multiplier: number): Partial<HeroStats> {
  const scaled: Partial<HeroStats> = {};
  for (const stat of STAT_KEYS) {
    const value = stats[stat];
    if (value) scaled[stat] = Math.max(1, Math.round(value * multiplier));
  }
  return scaled;
}

/** Name of an item given its base name and first affix ("Épée en fer du Colosse"). */
export function itemDisplayName(baseName: string, affixes: ItemAffix[]): string {
  const suffix = affixes[0] ? getAffix(affixes[0].affixId)?.suffix : undefined;
  return suffix ? `${baseName} ${suffix}` : baseName;
}

export type RolledItem = Pick<Item, "name" | "baseName" | "slot" | "rarity" | "tier" | "statBonus" | "affixes">;

/** Rolls a new item: rarity scales `baseStats` and decides how many affixes it gets. */
export function rollItem(
  rng: () => number,
  params: { baseName: string; slot: ItemSlot; tier: number; baseStats: Partial<HeroStats>; rarity: ItemRarity },
): RolledItem {
  const tier = clampTier(params.tier);
  const affixes = rollAffixes(rng, params.slot, tier, AFFIX_COUNT[params.rarity]);
  return {
    name: itemDisplayName(params.baseName, affixes),
    baseName: params.baseName,
    slot: params.slot,
    rarity: params.rarity,
    tier,
    statBonus: scaleStats(params.baseStats, RARITY_BASE_MULTIPLIER[params.rarity]),
    affixes,
  };
}

export function enhanceMultiplier(enhanceLevel: number | undefined): number {
  return 1 + (enhanceLevel ?? 0) * ENHANCE_BONUS_PER_LEVEL;
}

/** One stat line (base or affix) as it actually counts: positive values boosted by enhancement. */
export function enhancedLine(stats: Partial<HeroStats>, enhanceLevel: number | undefined): Partial<HeroStats> {
  const multiplier = enhanceMultiplier(enhanceLevel);
  const out: Partial<HeroStats> = {};
  for (const stat of STAT_KEYS) {
    const value = stats[stat];
    if (!value) continue;
    out[stat] = Math.round(value > 0 ? value * multiplier : value);
  }
  return out;
}

/** An item's total stat contribution: base + affixes, with positive values boosted by enhancement. */
export function itemTotalStats(item: Pick<Item, "statBonus" | "affixes" | "enhanceLevel">): Partial<HeroStats> {
  const multiplier = enhanceMultiplier(item.enhanceLevel);
  const total: Partial<HeroStats> = {};
  const sources = [item.statBonus, ...(item.affixes ?? []).map((a) => a.statBonus)];
  for (const source of sources) {
    for (const stat of STAT_KEYS) {
      const value = source[stat];
      if (!value) continue;
      total[stat] = (total[stat] ?? 0) + (value > 0 ? value * multiplier : value);
    }
  }
  for (const stat of STAT_KEYS) {
    if (total[stat] === undefined) continue;
    const rounded = Math.round(total[stat]!);
    if (rounded === 0) delete total[stat];
    else total[stat] = rounded;
  }
  return total;
}

/** Cost and success chance to go from `item.enhanceLevel` to +1. Levels up to +5 always succeed;
 *  past that a failure consumes the cost but never downgrades the item. */
export function enhanceCost(item: Pick<Item, "rarity" | "enhanceLevel">): {
  gold: number;
  shards: number;
  successChance: number;
} {
  const level = item.enhanceLevel ?? 0;
  const r = rarityIndex(item.rarity);
  const successChance = level < 5 ? 1 : Math.max(0.3, 1 - (level - 4) * 0.13);
  return {
    gold: 20 * (level + 1) * (r + 1),
    shards: level + 1 + r,
    successChance,
  };
}

/** Cost to reroll all of an item's affixes (only meaningful for items that have some). */
export function reforgeCost(item: Pick<Item, "rarity" | "tier">): { gold: number; shards: number } {
  const r = rarityIndex(item.rarity);
  return { gold: 30 * r * clampTier(item.tier), shards: 2 + r * 2 };
}

const SALVAGE_RESOURCE: Record<ItemSlot, ResourceKind> = {
  weapon: "ore",
  armor: "wood",
  trinket: "essence",
};

/** What salvaging an item returns: forge shards (more for rarer / higher-tier / enhanced items)
 *  and some of the slot's main crafting resource. */
export function salvageYield(item: Pick<Item, "rarity" | "tier" | "slot" | "enhanceLevel">): {
  shards: number;
  resources: Partial<Record<ResourceKind, number>>;
} {
  const r = rarityIndex(item.rarity);
  const tier = clampTier(item.tier);
  const level = item.enhanceLevel ?? 0;
  return {
    shards: (1 + r * 2) * tier + Math.floor((level * (level + 1)) / 4),
    resources: { [SALVAGE_RESOURCE[item.slot]]: 2 * tier * (r + 1) },
  };
}
