import { createRng, randomInt } from "@/lib/game/engine/rng";
import { MAX_ITEM_TIER, rollItem, rollRarity, type RolledItem } from "@/lib/game/engine/items";
import { getDifficulty } from "@/lib/game/content/difficulties";
import type {
  Difficulty,
  HeroStats,
  ItemRarity,
  ItemSlot,
  ResourceKind,
  ZoneDefinition,
} from "@/types/game";

const ITEM_SLOTS: ItemSlot[] = ["weapon", "armor", "trinket"];
const ITEM_NAMES: Record<ItemSlot, string[]> = {
  weapon: ["Lame trouvée", "Dague rouillée", "Bâton noueux"],
  armor: ["Veste rapiécée", "Plastron cabossé", "Cape usée"],
  trinket: ["Anneau terni", "Breloque ternie", "Talisman fissuré"],
};
/** Found-item rarity odds — a bit stingier than crafting a matching-tier recipe. Identical on every
 *  difficulty: harder tiers raise item tier/stats, never these odds. */
const LOOT_RARITY_WEIGHTS: Record<ItemRarity, number> = { commun: 66, rare: 24, epique: 8, legendaire: 2 };

export type DroppedItem = RolledItem;

export interface ExpeditionLootResult {
  gold: number;
  resources: Partial<Record<ResourceKind, number>>;
  item?: DroppedItem;
  monsterCaptured?: string;
}

/** A boss kill guarantees an item and tilts its rarity upward. */
const BOSS_RARITY_WEIGHTS: Record<ItemRarity, number> = { commun: 30, rare: 42, epique: 22, legendaire: 6 };

/** What POST /api/expeditions/claim returns to the result screen. */
export interface ExpeditionClaimResponse {
  loot: ExpeditionLootResult;
  survived: boolean;
  stars: number;
  bossKilled: boolean;
  killCount: number;
  crystalsEarned: number;
  rankTokensEarned: number;
  /** True when this claim paid the zone's daily first-victory bonus. */
  dailyBonus: boolean;
  difficulty: Difficulty;
  xpGained: number;
  levelUps: { heroId: string; name: string; from: number; to: number }[];
  newBestStars: boolean;
  unlockedZoneName?: string;
  /** Name of the difficulty this victory just opened on the zone, if any. */
  unlockedDifficultyName?: string;
}

function rollDroppedItem(
  rng: () => number,
  zoneDifficulty: number,
  weights: Record<ItemRarity, number>,
  difficulty: Difficulty | undefined,
): DroppedItem {
  const diff = getDifficulty(difficulty);
  const slot = ITEM_SLOTS[randomInt(rng, 0, ITEM_SLOTS.length - 1)];
  const rarity = rollRarity(rng, weights);
  const baseTier = zoneDifficulty < 20 ? 1 : zoneDifficulty < 40 ? 2 : 3;
  const tier = Math.min(MAX_ITEM_TIER, baseTier + diff.itemTierBonus);
  const power = Math.round((2 + zoneDifficulty / 15) * diff.statMul ** 0.75);

  const statKeys: (keyof HeroStats)[] = ["atkPhys", "atkMag", "defPhys", "defMag", "hp", "spd"];
  const primaryStat = statKeys[randomInt(rng, 0, statKeys.length - 1)];
  const baseStats: Partial<HeroStats> = {
    [primaryStat]: primaryStat === "hp" ? power * 3 : power,
  };

  const names = ITEM_NAMES[slot];
  const baseName = names[randomInt(rng, 0, names.length - 1)];

  return rollItem(rng, { baseName, slot, tier, baseStats, rarity });
}

/** Extra reward for conquering a dungeon (every treasure room reached), created from nothing —
 *  never taken from the defender. Scales with the dungeon's defense level so harder dungeons are
 *  worth the all-or-nothing risk. The item uses the boss-kill rarity odds (a conquest is the
 *  dungeon's "boss"), its tier and stats follow the defense level. */
export interface ConquestBounty {
  gold: number;
  forgeShards: number;
  item: DroppedItem;
}

/** Defense level at which the bounty item reaches each tier (index = tier - 1). */
const BOUNTY_TIER_LEVELS = [0, 10, 20, 35, 50];

export function conquestBountyTier(defenseLevel: number): number {
  let tier = 1;
  BOUNTY_TIER_LEVELS.forEach((level, i) => {
    if (defenseLevel >= level) tier = i + 1;
  });
  return Math.min(MAX_ITEM_TIER, tier);
}

/** Gold is only for real players' dungeons (a bot's gold is already in its fixed loot). */
export function conquestBountyPreview(defenseLevel: number, vsBot: boolean): { gold: number; forgeShards: number; tier: number } {
  const level = Math.max(1, defenseLevel);
  return {
    gold: vsBot ? 0 : 60 + level * 12,
    forgeShards: 3 + Math.floor(level / 4),
    tier: conquestBountyTier(level),
  };
}

export function rollConquestBounty(seed: string, defenseLevel: number, vsBot: boolean): ConquestBounty {
  const rng = createRng(`${seed}:bounty`);
  const level = Math.max(1, defenseLevel);
  const { gold, forgeShards, tier } = conquestBountyPreview(level, vsBot);
  const slot = ITEM_SLOTS[randomInt(rng, 0, ITEM_SLOTS.length - 1)];
  const rarity = rollRarity(rng, BOSS_RARITY_WEIGHTS);
  const power = Math.round((2 + level / 6) * (1 + level / 20));
  const statKeys: (keyof HeroStats)[] = ["atkPhys", "atkMag", "defPhys", "defMag", "hp", "spd"];
  const primaryStat = statKeys[randomInt(rng, 0, statKeys.length - 1)];
  const names = BOUNTY_ITEM_NAMES[slot];
  const item = rollItem(rng, {
    baseName: names[randomInt(rng, 0, names.length - 1)],
    slot,
    tier,
    baseStats: { [primaryStat]: primaryStat === "hp" ? power * 3 : primaryStat === "spd" ? Math.max(1, Math.round(power / 3)) : power },
    rarity,
  });
  return { gold, forgeShards, item };
}

const BOUNTY_ITEM_NAMES: Record<ItemSlot, string[]> = {
  weapon: ["Lame du pillard", "Bâton du conquérant", "Hache du trésor"],
  armor: ["Cuirasse du pillard", "Manteau du conquérant", "Brigandine du trésor"],
  trinket: ["Sceau du conquérant", "Chevalière du pillard", "Relique du trésor"],
};

/** Rolls the loot for a finished expedition run. `performance` (0.3..1.5, see the claim route)
 *  scales gold/resources and the item chance; a boss kill guarantees a better item.
 *  `zone` must already be scaled to `difficulty` (zoneAtDifficulty) for gold/resource amounts.
 *  Seeded so a claim can be re-verified deterministically. */
export function rollExpeditionLoot(
  zone: ZoneDefinition,
  performance: number,
  bossKilled: boolean,
  seed: string,
  difficulty?: Difficulty,
): ExpeditionLootResult {
  const rng = createRng(seed);

  const gold = Math.round(randomInt(rng, zone.loot.goldMin, zone.loot.goldMax) * performance);

  const resources: Partial<Record<ResourceKind, number>> = {};
  for (const [kind, range] of Object.entries(zone.loot.resourceDrops)) {
    if (!range) continue;
    const [min, max] = range;
    resources[kind as ResourceKind] = Math.round(randomInt(rng, min, max) * performance);
  }

  const itemRoll = rng();
  const item = bossKilled
    ? rollDroppedItem(rng, zone.difficulty, BOSS_RARITY_WEIGHTS, difficulty)
    : itemRoll < zone.loot.itemDropChance * performance
      ? rollDroppedItem(rng, zone.difficulty, LOOT_RARITY_WEIGHTS, difficulty)
      : undefined;

  let monsterCaptured: string | undefined;
  if (zone.loot.monsterCaptureChance && zone.loot.monsterCaptureRefId) {
    if (rng() < zone.loot.monsterCaptureChance * (bossKilled ? 2 : 1)) {
      monsterCaptured = zone.loot.monsterCaptureRefId;
    }
  }

  return { gold, resources, item, monsterCaptured };
}
