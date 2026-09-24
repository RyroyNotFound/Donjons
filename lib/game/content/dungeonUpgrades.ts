import type { DungeonUpgrades, DungeonUpgradeTrackId, ResourceKind } from "@/types/game";

/** Fresh account levels. Docs written before a track existed simply lack its key — read with `?? 0`. */
export const DEFAULT_UPGRADE_LEVELS: DungeonUpgrades["levels"] = {
  expansion: 0,
  architecture: 0,
  defenderVigor: 0,
  trapcraft: 0,
  beastMastery: 0,
  hazardDensity: 0,
  vaultCapacity: 0,
  elementalWards: 0,
  heroSlots: 0,
};

export interface DungeonUpgradeTrack {
  id: DungeonUpgradeTrackId;
  name: string;
  description: string;
  maxLevel: number;
  /** Resource weights at level 0->1, scaled by 1.35^currentLevel for later levels. */
  baseCost: Partial<Record<ResourceKind, number>>;
  effectLabel: (level: number) => string;
}

export const DUNGEON_UPGRADE_TRACKS: DungeonUpgradeTrack[] = [
  {
    id: "expansion",
    name: "Expansion",
    description: "Augmente le nombre maximum de salles constructibles.",
    maxLevel: 6,
    baseCost: { wood: 20, ore: 10 },
    effectLabel: (level) => `${maxRoomsForLevel(level)} salles max`,
  },
  {
    id: "architecture",
    name: "Architecture",
    description: "Augmente le budget de points disponible pour équiper vos salles.",
    maxLevel: 8,
    baseCost: { wood: 15, ore: 15 },
    effectLabel: (level) => `${pointBudgetForLevel(level)} points de budget`,
  },
  {
    id: "defenderVigor",
    name: "Vigueur défensive",
    description: "Renforce les PV/ATQ de votre garnison et augmente sa capacité.",
    maxLevel: 9,
    baseCost: { ore: 15, essence: 10 },
    effectLabel: (level) =>
      `Garnison : ${garrisonCapacityForLevel(level)} héros, +${Math.round(
        (garrisonStatMultiplierForLevel(level) - 1) * 100,
      )}% stats`,
  },
  {
    id: "trapcraft",
    name: "Ingénierie des pièges",
    description: "Débloque des pièges plus puissants (niv. 3 et 6) et augmente les dégâts de tous vos pièges.",
    maxLevel: 9,
    baseCost: { ore: 20, essence: 5 },
    effectLabel: (level) =>
      `+${Math.round((trapDamageMultiplierForLevel(level) - 1) * 100)}% dégâts des pièges · tier ${trapTierForLevel(level)} débloqué`,
  },
  {
    id: "beastMastery",
    name: "Maîtrise des bêtes",
    description: "Renforce les monstres capturés placés en garde dans votre donjon.",
    maxLevel: 10,
    baseCost: { essence: 20 },
    effectLabel: (level) =>
      `+${Math.round((beastMasteryMultiplierForLevel(level) - 1) * 100)}% stats des monstres gardiens`,
  },
  {
    id: "hazardDensity",
    name: "Densité des dangers",
    description: "Permet d'empiler davantage de pièges ou de monstres dans une même salle.",
    maxLevel: 9,
    baseCost: { wood: 10, ore: 10, essence: 10 },
    effectLabel: (level) => `${maxOccupantsForLevel(level)} occupant(s) par salle`,
  },
  {
    // Id kept from the old "Capacité du trésor" track so already-bought levels carry over.
    id: "vaultCapacity",
    name: "Coffre-fort",
    description: "Protège votre réserve : les pillards qui atteignent vos trésors emportent moins d'or et de ressources.",
    maxLevel: 6,
    baseCost: { wood: 15, essence: 15 },
    effectLabel: (level) => `-${Math.round((1 - vaultStealMultiplierForLevel(level)) * 100)}% de butin volé`,
  },
  {
    id: "elementalWards",
    name: "Sceaux élémentaires",
    description: "Grave des sceaux dans vos murs : monstres et garnison résistent mieux au feu, à la glace, à la foudre, au sacré et à l'ombre.",
    maxLevel: 8,
    baseCost: { ore: 10, essence: 20 },
    effectLabel: (level) => `+${wardResistanceForLevel(level)}% résistance à tous les éléments`,
  },
];

// Hero roster slots used to be a dungeon track; they're now bought with gold from the Héros page
// (see heroSlotCost in lib/game/economy.ts), but the level still lives in dungeonUpgrades.levels.heroSlots.
export const HERO_SLOTS_MAX_LEVEL = 11;

export function getUpgradeTrack(id: DungeonUpgradeTrackId): DungeonUpgradeTrack {
  const track = DUNGEON_UPGRADE_TRACKS.find((t) => t.id === id);
  if (!track) throw new Error(`Filière d'amélioration inconnue: ${id}`);
  return track;
}

export function maxRoomsForLevel(level: number): number {
  return 6 + level * 2;
}

export function pointBudgetForLevel(level: number): number {
  return 12 + level * 5;
}

/** A dungeon's defense level: the average level of its owner's 4 best heroes (min 1). It scales the
 *  dungeon's monsters (monsterScaleForDefenseLevel) and adds budget, so a dungeon grows with its owner. */
export function dungeonDefenseLevel(heroLevels: number[]): number {
  const best = [...heroLevels].sort((a, b) => b - a).slice(0, 4);
  if (best.length === 0) return 1;
  return Math.max(1, Math.round(best.reduce((s, l) => s + l, 0) / best.length));
}

/** Total point budget: the Architecture track plus 1 point per 3 defense levels. */
export function dungeonPointBudget(architectureLevel: number, defenseLevel: number): number {
  return pointBudgetForLevel(architectureLevel) + Math.floor(Math.max(1, defenseLevel) / 3);
}

export function garrisonCapacityForLevel(level: number): number {
  return Math.floor(level / 3);
}

export function garrisonStatMultiplierForLevel(level: number): number {
  return 1 + level * 0.05;
}

export function trapDamageMultiplierForLevel(level: number): number {
  return 1 + level * 0.05;
}

/** Highest trap tier placeable at this Trapcraft level (mirrors trapTierUnlockedAtLevel). */
export function trapTierForLevel(level: number): 1 | 2 | 3 {
  return level >= 6 ? 3 : level >= 3 ? 2 : 1;
}

export function beastMasteryMultiplierForLevel(level: number): number {
  return 1 + level * 0.06;
}

export function maxOccupantsForLevel(level: number): number {
  return 1 + Math.floor(level / 3);
}

/** Multiplier on what a raider steals: -7% per Coffre-fort level (-42% at max). */
export function vaultStealMultiplierForLevel(level: number): number {
  return 1 - level * 0.07;
}

/** Flat resistance (in %) added to every element for the dungeon's monsters and garrison. */
export function wardResistanceForLevel(level: number): number {
  return level * 4;
}

/** Level 0 = 1 (the starting blank hero), so bootstrap's default level matches the starter roster size. */
export function heroSlotsForLevel(level: number): number {
  return 1 + level;
}
