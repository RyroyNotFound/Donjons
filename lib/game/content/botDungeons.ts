// Hand-authored "bot" dungeons: always-available raid targets so the attack
// screen isn't empty before real players configure their own dungeon. Layouts
// are connected by construction (each cell placed adjacent to one already in
// the list), same grid/adjacency rules as player-built dungeons.

import { ENTRANCE_CELL } from "@/lib/game/content/dungeon";
import type { BattleReward, DungeonRoomCell } from "@/types/game";

export interface BotDungeonDefinition {
  id: string;
  name: string;
  tier: number;
  /** Scales the monsters like a player's dungeon (see monsterScaleForDefenseLevel). */
  defenseLevel: number;
  /** Shown on the target card: what this dungeon teaches the attacker to prepare for. */
  hint: string;
  rooms: DungeonRoomCell[];
  loot: BattleReward;
}

const ENTRANCE: DungeonRoomCell = { ...ENTRANCE_CELL, type: "empty" };

export const BOT_DUNGEONS: BotDungeonDefinition[] = [
  {
    id: "goblin-den",
    name: "Repaire des gobelins",
    tier: 1,
    defenseLevel: 3,
    hint: "Un premier raid sans surprise.",
    rooms: [
      ENTRANCE,
      { row: 2, col: 1, type: "monster", monsterRefIds: ["gobelin-eclaireur"] },
      { row: 2, col: 2, type: "treasure" },
    ],
    loot: { gold: 40, resources: { wood: 5 } },
  },
  {
    id: "toxic-cave",
    name: "Grotte du gaz toxique",
    tier: 2,
    defenseLevel: 12,
    hint: "Des pièges dès l'entrée : un soigneur aide à tenir la distance.",
    rooms: [
      ENTRANCE,
      { row: 2, col: 1, type: "trap", trapIds: ["fosse-a-pieux"] },
      { row: 2, col: 2, type: "monster", monsterRefIds: ["araignee-venimeuse"] },
      { row: 1, col: 2, type: "trap", trapIds: ["gaz-toxique"] },
      { row: 3, col: 2, type: "monster", monsterRefIds: ["gobelin-eclaireur", "gobelin-eclaireur"] },
      { row: 2, col: 3, type: "treasure" },
    ],
    loot: { gold: 80, resources: { wood: 8, ore: 8 } },
  },
  {
    id: "stone-golem-vault",
    name: "Caveau du golem de pierre",
    tier: 3,
    defenseLevel: 25,
    hint: "Morts-vivants et givre : attaques sacrées ou de feu, résistance à la glace.",
    rooms: [
      ENTRANCE,
      { row: 2, col: 1, type: "monster", monsterRefIds: ["golem-de-pierre"] },
      { row: 1, col: 1, type: "trap", trapIds: ["fosse-a-pieux", "pluie-de-givre"] },
      { row: 3, col: 1, type: "trap", trapIds: ["gaz-toxique", "pluie-de-givre"] },
      { row: 2, col: 2, type: "monster", monsterRefIds: ["golem-de-pierre", "araignee-venimeuse"] },
      { row: 1, col: 2, type: "treasure" },
      { row: 3, col: 2, type: "treasure" },
      { row: 2, col: 3, type: "monster", monsterRefIds: ["golem-de-pierre", "golem-de-pierre"] },
      { row: 2, col: 4, type: "treasure" },
    ],
    loot: { gold: 150, resources: { wood: 12, ore: 12, essence: 6 } },
  },
  {
    id: "shadow-lord-keep",
    name: "Bastion du seigneur des ombres",
    tier: 4,
    defenseLevel: 38,
    hint: "La liche frappe en ombre : résistance à l'ombre et attaques sacrées.",
    rooms: [
      ENTRANCE,
      { row: 2, col: 1, type: "monster", monsterRefIds: ["gobelin-eclaireur", "araignee-venimeuse"] },
      { row: 2, col: 2, type: "trap", trapIds: ["runes-explosives", "voile-d-ombre"] },
      { row: 2, col: 3, type: "monster", monsterRefIds: ["araignee-venimeuse", "araignee-venimeuse"] },
      { row: 1, col: 3, type: "trap", trapIds: ["gaz-toxique", "voile-d-ombre"] },
      { row: 3, col: 3, type: "monster", monsterRefIds: ["golem-de-pierre", "golem-de-pierre"] },
      { row: 2, col: 4, type: "monster", monsterRefIds: ["seigneur-des-ombres", "golem-de-pierre"] },
      { row: 1, col: 4, type: "treasure" },
      { row: 3, col: 4, type: "treasure" },
    ],
    loot: { gold: 300, resources: { wood: 20, ore: 20, essence: 20 } },
  },
  {
    id: "trapped-sanctum",
    name: "Sanctuaire piégé",
    tier: 5,
    defenseLevel: 55,
    hint: "Presque que des pièges, de tous les éléments : Désamorçage et résistance aux pièges indispensables.",
    rooms: [
      ENTRANCE,
      { row: 2, col: 1, type: "trap", trapIds: ["fosse-a-pieux", "gaz-toxique", "arc-foudroyant"] },
      { row: 2, col: 2, type: "trap", trapIds: ["pluie-de-givre", "runes-explosives", "glyphe-sacre"] },
      { row: 1, col: 2, type: "treasure" },
      { row: 2, col: 3, type: "monster", monsterRefIds: ["araignee-venimeuse", "golem-de-pierre"] },
      { row: 3, col: 3, type: "trap", trapIds: ["voile-d-ombre", "arc-foudroyant", "gaz-toxique"] },
      { row: 3, col: 4, type: "treasure" },
      { row: 2, col: 4, type: "trap", trapIds: ["glyphe-sacre", "voile-d-ombre", "runes-explosives", "fosse-a-pieux"] },
      { row: 1, col: 4, type: "treasure" },
    ],
    loot: { gold: 450, resources: { wood: 30, ore: 30, essence: 30 } },
  },
];

export const BOT_DEFENDER_PREFIX = "bot:";

export function isBotDefenderId(defenderId: string): boolean {
  return defenderId.startsWith(BOT_DEFENDER_PREFIX);
}

export function getBotDungeon(defenderId: string): BotDungeonDefinition {
  const id = defenderId.slice(BOT_DEFENDER_PREFIX.length);
  const bot = BOT_DUNGEONS.find((b) => b.id === id);
  if (!bot) throw new Error(`Donjon bot inconnu: ${defenderId}`);
  return bot;
}
