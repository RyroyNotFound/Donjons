import type { DungeonUpgradeTrackId, ResourceKind } from "@/types/game";

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
    description: "Débloque des pièges plus puissants et augmente leur nombre de charges.",
    maxLevel: 9,
    baseCost: { ore: 20, essence: 5 },
    effectLabel: (level) => `+${trapExtraChargesForLevel(level)} charge(s) de piège`,
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
    id: "vaultCapacity",
    name: "Capacité du trésor",
    description: "Augmente la réserve de butin totale de votre donjon.",
    maxLevel: 6,
    baseCost: { wood: 15, essence: 15 },
    effectLabel: (level) => `+${Math.round((vaultCapacityMultiplierForLevel(level) - 1) * 100)}% butin`,
  },
  {
    id: "heroSlots",
    name: "Antre des héros",
    description: "Débloque des emplacements pour recruter de nouveaux héros.",
    maxLevel: 10,
    baseCost: { wood: 25, ore: 25, essence: 15 },
    effectLabel: (level) => `${heroSlotsForLevel(level)} héros`,
  },
];

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

export function garrisonCapacityForLevel(level: number): number {
  return Math.floor(level / 3);
}

export function garrisonStatMultiplierForLevel(level: number): number {
  return 1 + level * 0.05;
}

export function trapExtraChargesForLevel(level: number): number {
  return Math.floor(level / 2);
}

export function beastMasteryMultiplierForLevel(level: number): number {
  return 1 + level * 0.06;
}

export function maxOccupantsForLevel(level: number): number {
  return 1 + Math.floor(level / 3);
}

export function vaultCapacityMultiplierForLevel(level: number): number {
  return 1 + level * 0.05;
}

/** Level 0 = 1 (the starting blank hero), so bootstrap's default level matches the starter roster size. */
export function heroSlotsForLevel(level: number): number {
  return 1 + level;
}
