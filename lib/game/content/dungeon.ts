import { fullStats } from "@/lib/game/engine/elements";
import type { MonsterDefinition, TrapDefinition } from "@/types/game";

// Fixed 5x5 board, orthogonal adjacency. A grid (rather than a free-form
// node graph) keeps placement, connectivity validation and raid fog-of-war
// all trivial: neighbors are just +/-1 row or column.
export const GRID_ROWS = 5;
export const GRID_COLS = 5;
// Middle of the left edge, so a layout can branch up, down and right.
export const ENTRANCE_CELL = { row: 2, col: 0 };

export const MIN_TREASURE_ROOMS = 1;
/** Monster stat multiplier from a dungeon's defense level (its owner's heroes' level): a level-40
 *  owner's orcs hit like level-40 monsters. Beast Mastery then multiplies on top. */
export function monsterScaleForDefenseLevel(defenseLevel: number | undefined): number {
  return 1 + 0.45 * Math.max(0, (defenseLevel ?? 1) - 1);
}
export const MAX_TREASURE_ROOMS = 4;
export const TREASURE_ROOM_COST = 4;

export const TRAPS: TrapDefinition[] = [
  {
    id: "fosse-a-pieux",
    name: "Fosse à pieux",
    description: "Inflige des dégâts à toute l'équipe adverse à l'entrée.",
    tier: 1,
    cost: 2,
    damagePercent: 0.1,
    baseCharges: 2,
  },
  {
    id: "gaz-toxique",
    name: "Gaz toxique",
    description: "Dégâts modérés à toute l'équipe adverse.",
    tier: 2,
    cost: 3,
    damagePercent: 0.16,
    baseCharges: 2,
  },
  {
    id: "runes-explosives",
    name: "Runes explosives",
    description: "Dégâts lourds à toute l'équipe adverse.",
    tier: 3,
    cost: 5,
    damagePercent: 0.24,
    baseCharges: 1,
    element: "feu",
  },
  {
    id: "pluie-de-givre",
    name: "Pluie de givre",
    description: "Des éclats de glace s'abattent sur l'équipe (dégâts de glace).",
    tier: 2,
    cost: 3,
    damagePercent: 0.14,
    baseCharges: 2,
    element: "glace",
  },
  {
    id: "arc-foudroyant",
    name: "Arc foudroyant",
    description: "Un éclair saute d'un héros à l'autre (dégâts de foudre).",
    tier: 2,
    cost: 3,
    damagePercent: 0.14,
    baseCharges: 2,
    element: "foudre",
  },
  {
    id: "glyphe-sacre",
    name: "Glyphe sacré",
    description: "Une lumière aveuglante brûle les intrus (dégâts sacrés).",
    tier: 3,
    cost: 4,
    damagePercent: 0.19,
    baseCharges: 1,
    element: "sacre",
  },
  {
    id: "voile-d-ombre",
    name: "Voile d'ombre",
    description: "Des ténèbres qui rongent la vie (dégâts d'ombre).",
    tier: 3,
    cost: 4,
    damagePercent: 0.19,
    baseCharges: 1,
    element: "ombre",
  },
];

/** Each extra trap stacked in the same room hits for this much less than the previous one — a room of
 *  4 traps is nasty, not an instant wipe. */
export const TRAP_STACK_FALLOFF = 0.8;

export const MONSTERS: MonsterDefinition[] = [
  {
    id: "gobelin-eclaireur",
    name: "Orc éclaireur",
    description: "Rapide en éclaireur, mais peu armé.",
    cost: 2,
    // Fast skirmisher: burns easily, slips through the shadows.
    stats: fullStats({ hp: 60, atkPhys: 10, defPhys: 3, defMag: 1, spd: 12, crit: 8, critDmg: 50, resFeu: -40, resFoudre: -15, resOmbre: 25 }),
  },
  {
    id: "golem-de-pierre",
    name: "Golem d'ossements",
    description: "Une armure de squelette animée par une magie noire, lente mais increvable.",
    cost: 4,
    // Undead: holy and fire burn it, shadow and frost barely scratch it.
    stats: fullStats({ hp: 140, atkPhys: 9, defPhys: 12, defMag: 6, spd: 4, critDmg: 50, resSacre: -40, resFeu: -20, resOmbre: 25, resGlace: 20 }),
  },
  {
    id: "araignee-venimeuse",
    name: "Orc chaman",
    description: "Manie la magie tribale en plus de son gourdin, bon équilibre attaque/vitesse.",
    cost: 3,
    // Storm shaman: hurls lightning, shrugs it off, dreads frost.
    stats: fullStats({ hp: 90, atkPhys: 9, atkMag: 6, defPhys: 5, defMag: 3, spd: 10, crit: 5, critDmg: 50, resFoudre: 25, resGlace: -40, resFeu: 10 }),
    element: "foudre",
  },
];

export const BOSSES: MonsterDefinition[] = [
  {
    id: "seigneur-des-ombres",
    name: "Liche des ombres",
    description: "Le nécromancien qui hante les profondeurs du donjon, gardien final.",
    cost: 8,
    isBoss: true,
    // Shadow lich: casts shadow, immune-ish to it, weak to holy and fire.
    stats: fullStats({ hp: 260, atkPhys: 8, atkMag: 16, defPhys: 8, defMag: 12, spd: 9, crit: 10, critDmg: 50, resOmbre: 35, resGlace: 15, resSacre: -40, resFeu: -20 }),
    element: "ombre",
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
