import type { MonsterDefinition, TrapDefinition } from "@/types/game";

export const DUNGEON_ROOM_COUNT = 3;
export const DUNGEON_POINT_BUDGET = 12;

export const TRAPS: TrapDefinition[] = [
  {
    id: "fosse-a-pieux",
    name: "Fosse à pieux",
    description: "Inflige des dégâts à toute l'équipe adverse à l'entrée.",
    cost: 2,
    damagePercent: 0.08,
  },
  {
    id: "gaz-toxique",
    name: "Gaz toxique",
    description: "Dégâts modérés à toute l'équipe adverse.",
    cost: 3,
    damagePercent: 0.14,
  },
  {
    id: "runes-explosives",
    name: "Runes explosives",
    description: "Dégâts lourds à toute l'équipe adverse.",
    cost: 5,
    damagePercent: 0.22,
  },
];

export const MONSTERS: MonsterDefinition[] = [
  {
    id: "gobelin-eclaireur",
    name: "Gobelin éclaireur",
    description: "Monstre rapide mais fragile.",
    cost: 2,
    stats: { hp: 60, atk: 10, def: 3, spd: 12 },
  },
  {
    id: "golem-de-pierre",
    name: "Golem de pierre",
    description: "Très résistant, riposte lentement.",
    cost: 4,
    stats: { hp: 140, atk: 9, def: 12, spd: 4 },
  },
  {
    id: "araignee-venimeuse",
    name: "Araignée venimeuse",
    description: "Bon équilibre attaque/vitesse.",
    cost: 3,
    stats: { hp: 90, atk: 13, def: 6, spd: 10 },
  },
];

export const BOSSES: MonsterDefinition[] = [
  {
    id: "seigneur-des-ombres",
    name: "Seigneur des ombres",
    description: "Le gardien final du donjon.",
    cost: 0,
    isBoss: true,
    stats: { hp: 260, atk: 20, def: 10, spd: 9 },
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
