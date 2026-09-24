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
  /** Loot of a full 4-treasure-room dungeon: each treasure room here holds a quarter of it. */
  loot: BattleReward;
}

const ENTRANCE: DungeonRoomCell = { ...ENTRANCE_CELL, type: "empty" };

export const BOT_DUNGEONS: BotDungeonDefinition[] = [
  {
    id: "goblin-den",
    name: "Repaire des orcs",
    tier: 1,
    defenseLevel: 3,
    hint: "Un premier raid sans surprise.",
    rooms: [
      ENTRANCE,
      { row: 2, col: 1, type: "monster", monsterRefIds: ["gobelin-eclaireur"] },
      { row: 2, col: 2, type: "treasure" },
    ],
    loot: { gold: 320, resources: { wood: 40 } },
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
    loot: { gold: 640, resources: { wood: 64, ore: 64 } },
  },
  {
    id: "stone-golem-vault",
    name: "Caveau du golem d'ossements",
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
    loot: { gold: 1200, resources: { wood: 96, ore: 96, essence: 48 } },
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
    loot: { gold: 2400, resources: { wood: 160, ore: 160, essence: 160 } },
  },
  {
    id: "trapped-sanctum",
    name: "Sanctuaire piégé",
    tier: 5,
    defenseLevel: 55,
    hint: "Surtout des pièges, de tous les éléments, puis un gardien avant les trésors : Désamorçage et résistance aux pièges font la différence.",
    // Every treasure sits behind the guardian room: traps never kill, so a trap-only path to a
    // treasure would be a risk-free farm.
    rooms: [
      ENTRANCE,
      { row: 2, col: 1, type: "trap", trapIds: ["fosse-a-pieux", "gaz-toxique", "arc-foudroyant"] },
      { row: 2, col: 2, type: "trap", trapIds: ["pluie-de-givre", "runes-explosives", "glyphe-sacre"] },
      { row: 2, col: 3, type: "monster", monsterRefIds: ["araignee-venimeuse", "golem-de-pierre"] },
      { row: 1, col: 3, type: "treasure" },
      { row: 3, col: 3, type: "trap", trapIds: ["voile-d-ombre", "arc-foudroyant", "gaz-toxique"] },
      { row: 3, col: 4, type: "treasure" },
      { row: 2, col: 4, type: "trap", trapIds: ["glyphe-sacre", "voile-d-ombre", "runes-explosives", "fosse-a-pieux"] },
      { row: 1, col: 4, type: "treasure" },
    ],
    loot: { gold: 3600, resources: { wood: 240, ore: 240, essence: 240 } },
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
