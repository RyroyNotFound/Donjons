import type { MonsterDefinition, TrapDefinition } from "@/types/game";

// Fixed 5x5 board, orthogonal adjacency. A grid (rather than a free-form
// node graph) keeps placement, connectivity validation and raid fog-of-war
// all trivial: neighbors are just +/-1 row or column.
export const GRID_ROWS = 5;
export const GRID_COLS = 5;
// Middle of the left edge, so a layout can branch up, down and right.
export const ENTRANCE_CELL = { row: 2, col: 0 };

export const MIN_TREASURE_ROOMS = 1;
export const MAX_TREASURE_ROOMS = 4;
export const TREASURE_ROOM_COST = 4;

export const TRAPS: TrapDefinition[] = [
  {
    id: "fosse-a-pieux",
    name: "Fosse à pieux",
    description: "Inflige des dégâts à toute l'équipe adverse à l'entrée.",
    tier: 1,
    cost: 2,
    damagePercent: 0.08,
    baseCharges: 2,
  },
  {
    id: "gaz-toxique",
    name: "Gaz toxique",
    description: "Dégâts modérés à toute l'équipe adverse.",
    tier: 2,
    cost: 3,
    damagePercent: 0.14,
    baseCharges: 2,
  },
  {
    id: "runes-explosives",
    name: "Runes explosives",
    description: "Dégâts lourds à toute l'équipe adverse.",
    tier: 3,
    cost: 5,
    damagePercent: 0.22,
    baseCharges: 1,
  },
];

export const MONSTERS: MonsterDefinition[] = [
  {
    id: "gobelin-eclaireur",
    name: "Orc éclaireur",
    description: "Rapide en éclaireur, mais peu armé.",
    cost: 2,
    stats: { hp: 60, atkPhys: 10, atkMag: 0, defPhys: 3, defMag: 1, spd: 12 },
  },
  {
    id: "golem-de-pierre",
    name: "Golem d'ossements",
    description: "Une armure de squelette animée par une magie noire, lente mais increvable.",
    cost: 4,
    stats: { hp: 140, atkPhys: 9, atkMag: 0, defPhys: 12, defMag: 6, spd: 4 },
  },
  {
    id: "araignee-venimeuse",
    name: "Orc chaman",
    description: "Manie la magie tribale en plus de son gourdin, bon équilibre attaque/vitesse.",
    cost: 3,
    stats: { hp: 90, atkPhys: 9, atkMag: 6, defPhys: 5, defMag: 3, spd: 10 },
  },
];

export const BOSSES: MonsterDefinition[] = [
  {
    id: "seigneur-des-ombres",
    name: "Liche des ombres",
    description: "Le nécromancien qui hante les profondeurs du donjon, gardien final.",
    cost: 8,
    isBoss: true,
    stats: { hp: 260, atkPhys: 8, atkMag: 16, defPhys: 8, defMag: 12, spd: 9 },
  },
];

export function getTrap(id: string): TrapDefinition {
  const trap = TRAPS.find((t) => t.id === id);
  if (!trap) throw new Error(`Piège inconnu: ${id}`);
  return trap;
}

export function getMonster(id: string): MonsterDefinition {
  const monster =
    MONSTERS.find((m) => m.id === id) ?? BOSSES.find((m) => m.id === id);
  if (!monster) throw new Error(`Monstre inconnu: ${id}`);
  return monster;
}

export function trapTierUnlockedAtLevel(tier: 1 | 2 | 3): number {
  if (tier === 1) return 0;
  if (tier === 2) return 3;
  return 6;
}
