import type { Difficulty, ExpeditionRecord, ZoneDefinition } from "@/types/game";

// Expedition difficulty ladder, Diablo-style: every zone can be replayed on harder tiers
// with tougher monsters and bigger (but NOT rarer) rewards — gold/resources/XP amounts go up
// and dropped items roll at a higher tier (stronger stats and affixes), while the rarity odds
// and drop chances stay exactly those of lib/game/engine/loot.ts.
// A tier unlocks on a zone once the previous tier of that same zone was beaten with its boss (≥2★).

export interface DifficultyDefinition {
  id: Difficulty;
  name: string;
  icon: string;
  /** Multiplier on every monster's stats (on top of the zone's own statScale). */
  statMul: number;
  /** Multiplier on the zone's recommended power. */
  powerMul: number;
  /** Multiplier on gold and resource amounts. */
  lootMul: number;
  xpMul: number;
  /** Added to the dropped item's tier (capped by MAX_ITEM_TIER). */
  itemTierBonus: number;
  /** Extra crystals per victory, on top of the zone's base. */
  crystalBonus: number;
  /** One-time rewards the first time this (zone, difficulty) is cleared / 3-starred. */
  firstClear: { crystals: number; rankTokens: number };
  firstThreeStars: { crystals: number; rankTokens: number };
}

export const DIFFICULTIES: DifficultyDefinition[] = [
  {
    id: "normal",
    name: "Normal",
    icon: "🟢",
    statMul: 1,
    powerMul: 1,
    lootMul: 1,
    xpMul: 1,
    itemTierBonus: 0,
    crystalBonus: 0,
    firstClear: { crystals: 2, rankTokens: 1 },
    firstThreeStars: { crystals: 3, rankTokens: 2 },
  },
  {
    id: "difficile",
    name: "Difficile",
    icon: "🟡",
    statMul: 2.8,
    powerMul: 2.2,
    lootMul: 1.5,
    xpMul: 1.5,
    itemTierBonus: 1,
    crystalBonus: 0,
    firstClear: { crystals: 3, rankTokens: 2 },
    firstThreeStars: { crystals: 4, rankTokens: 3 },
  },
  {
    id: "cauchemar",
    name: "Cauchemar",
    icon: "🟠",
    statMul: 6.5,
    powerMul: 4,
    lootMul: 2.2,
    xpMul: 2,
    itemTierBonus: 1,
    crystalBonus: 1,
    firstClear: { crystals: 4, rankTokens: 3 },
    firstThreeStars: { crystals: 5, rankTokens: 4 },
  },
  {
    id: "tourment",
    name: "Tourment",
    icon: "🔴",
    statMul: 12,
    powerMul: 7,
    lootMul: 3.2,
    xpMul: 3,
    itemTierBonus: 2,
    crystalBonus: 1,
    firstClear: { crystals: 5, rankTokens: 4 },
    firstThreeStars: { crystals: 6, rankTokens: 6 },
  },
];

export function getDifficulty(id: Difficulty | undefined): DifficultyDefinition {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[0];
}

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.some((d) => d.id === value);
}

/** Key of a (zone, difficulty) pair in UserProfile.expeditionRecords. Normal keeps the bare zone id
 *  so records written before difficulties existed stay valid. */
export function recordKey(zoneId: string, difficulty: Difficulty | undefined): string {
  return !difficulty || difficulty === "normal" ? zoneId : `${zoneId}:${difficulty}`;
}

/** Whether `difficulty` is open on `zone` (the zone itself must be unlocked separately — see isZoneUnlocked). */
export function isDifficultyUnlocked(
  zoneId: string,
  difficulty: Difficulty,
  records: Record<string, ExpeditionRecord> | undefined,
): boolean {
  const index = DIFFICULTIES.findIndex((d) => d.id === difficulty);
  if (index <= 0) return true;
  const previous = DIFFICULTIES[index - 1].id;
  return (records?.[recordKey(zoneId, previous)]?.bestStars ?? 0) >= 2;
}

/** The zone as played on `difficulty`: tougher monsters, higher recommended power, bigger loot
 *  amounts and XP. Drop chances and rarity odds are untouched. Used by both the client arena
 *  and the claim route so they simulate the same run. */
export function zoneAtDifficulty(zone: ZoneDefinition, difficulty: Difficulty | undefined): ZoneDefinition {
  const def = getDifficulty(difficulty);
  if (def.id === "normal") return zone;
  // Cached so React consumers get a stable object per (zone, difficulty).
  const cacheKey = recordKey(zone.id, def.id);
  const cached = scaledZoneCache.get(cacheKey);
  if (cached) return cached;
  const scaled = buildScaledZone(zone, def);
  scaledZoneCache.set(cacheKey, scaled);
  return scaled;
}

const scaledZoneCache = new Map<string, ZoneDefinition>();

function buildScaledZone(zone: ZoneDefinition, def: DifficultyDefinition): ZoneDefinition {
  const scale = (n: number) => Math.round(n * def.lootMul);
  return {
    ...zone,
    statScale: zone.statScale * def.statMul,
    recommendedPower: Math.round(zone.recommendedPower * def.powerMul),
    xpReward: Math.round(zone.xpReward * def.xpMul),
    boss: { ...zone.boss, name: `${zone.boss.name} (${def.name})` },
    loot: {
      ...zone.loot,
      goldMin: scale(zone.loot.goldMin),
      goldMax: scale(zone.loot.goldMax),
      resourceDrops: Object.fromEntries(
        Object.entries(zone.loot.resourceDrops).map(([kind, range]) => [kind, range && [scale(range[0]), scale(range[1])]]),
      ),
    },
  };
}
