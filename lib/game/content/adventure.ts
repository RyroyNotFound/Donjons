// Adventure mode: 5 worlds x 5 dungeons played in order, each harder than the last (defense level
// 2 -> 60). A stage is explored with the raid engine (fog of war, traps, turn-based fights — see
// lib/game/engine/dungeonRaid.ts), under the defender id "adventure:<stageId>". It holds no loot:
// the first victory pays a one-time reward (currencies + a guaranteed item, see
// lib/game/dungeonRaidLifecycle.ts), recorded in UserProfile.adventureCleared. The last stage of each
// world is its boss. Layouts are generated once, deterministically, from each stage's id: a winding
// main path from the entrance to the seal (the only treasure room, always behind a guardian room —
// traps never kill, so an unguarded seal would be a free win), plus optional side rooms.

import { ENTRANCE_CELL, GRID_COLS, GRID_ROWS } from "@/lib/game/content/dungeon";
import { createRng, randomInt } from "@/lib/game/engine/rng";
import type { DungeonRoomCell, ItemRarity } from "@/types/game";

export const ADVENTURE_PREFIX = "adventure:";
export const STAGES_PER_WORLD = 5;

export function isAdventureDefenderId(defenderId: string): boolean {
  return defenderId.startsWith(ADVENTURE_PREFIX);
}

export interface AdventureWorld {
  id: string;
  name: string;
  description: string;
  /** What to prepare: shown on every stage of the world. */
  hint: string;
  monsterPool: string[];
  trapPool: string[];
  /** Guardian squad of the world's boss stage. */
  bossSquad: string[];
  stageNames: string[];
}

export const ADVENTURE_WORLDS: AdventureWorld[] = [
  {
    id: "lisiere",
    name: "Lisière sauvage",
    description: "Les orcs ont pris la forêt. Un premier pas, sans pièges retors.",
    hint: "Orcs sensibles au feu ; les pillards frappent fort mais tombent vite. Au boss, un orc cuirassé encaisse le physique : prévoyez de la magie.",
    monsterPool: ["gobelin-eclaireur", "gobelin-eclaireur", "orc-pillard", "chapardeur-halfelin", "araignee-venimeuse"],
    trapPool: ["fosse-a-pieux", "gaz-toxique"],
    bossSquad: ["orc-cuirasse", "orc-pillard", "araignee-venimeuse"],
    stageNames: ["Sentier des ronces", "Camp des éclaireurs", "Clairière brûlée", "Gué des chamans", "Hutte du chef de guerre"],
  },
  {
    id: "mines",
    name: "Mines englouties",
    description: "Des galeries inondées où les ondins ont chassé les chamans de l'orage.",
    hint: "Ondins de givre : la foudre les foudroie (−40 %), prévoyez de la résistance à la glace. Un mystique soigne les siens : abattez-le vite.",
    monsterPool: ["ondin-eclaireur", "ondin-eclaireur", "ondin-harponneur", "ondin-aquamancien", "araignee-venimeuse"],
    trapPool: ["fosse-a-pieux", "pluie-de-givre", "arc-foudroyant"],
    bossSquad: ["ondin-empaleur", "ondin-mystique", "ondin-aquamancien"],
    stageNames: ["Puits d'entrée", "Galerie effondrée", "Lac souterrain", "Forge des tempêtes", "Cœur de la mine"],
  },
  {
    id: "necropole",
    name: "Nécropole de givre",
    description: "Les morts veillent sous la glace. Ils encaissent tout, sauf la lumière.",
    hint: "Morts-vivants : attaques sacrées ou de feu, résistance à la glace et à l'ombre (spectres magiques : défense magique).",
    monsterPool: ["golem-de-pierre", "squelette", "squelette", "spectre-pourpre"],
    trapPool: ["pluie-de-givre", "fosse-a-pieux", "glyphe-sacre"],
    bossSquad: ["seigneur-des-ombres", "golem-de-pierre", "squelette"],
    stageNames: ["Portes gelées", "Ossuaire", "Crypte des veilleurs", "Allée des tombeaux", "Sanctuaire de la liche"],
  },
  {
    id: "citadelle",
    name: "Citadelle céleste",
    description: "La forteresse des elfes déchus, bardée de pièges, où la lumière blesse.",
    hint: "Elfes sacrés : l'ombre les défait (−40 %), résistance au sacré. Les enchanteresses soignent, le Seigneur elfe attire les coups et étourdit. Beaucoup de pièges : Désamorçage.",
    monsterPool: ["elfe-archere", "elfe-lame-dansante", "elfe-enchanteresse", "orc-cuirasse"],
    trapPool: ["arc-foudroyant", "runes-explosives", "glyphe-sacre", "gaz-toxique"],
    bossSquad: ["seigneur-elfe", "elfe-enchanteresse", "elfe-archere"],
    stageNames: ["Pont de lumière", "Chemin de ronde", "Jardins suspendus", "Tour des archères", "Trône du Seigneur elfe"],
  },
  {
    id: "trone",
    name: "Trône des ombres",
    description: "Le royaume de la liche. Personne n'en est revenu.",
    hint: "Ombre partout : résistance à l'ombre, attaques sacrées, soigneur indispensable.",
    monsterPool: ["spectre-pourpre", "golem-de-pierre", "ondin-empaleur", "elfe-lame-dansante", "seigneur-des-ombres"],
    trapPool: ["voile-d-ombre", "glyphe-sacre", "runes-explosives", "arc-foudroyant"],
    bossSquad: ["seigneur-des-ombres", "seigneur-elfe", "spectre-pourpre"],
    stageNames: ["Voile noir", "Jardin des cendres", "Galerie des spectres", "Antichambre", "Trône de la liche"],
  },
];

export interface AdventureReward {
  gold: number;
  crystals: number;
  stardust: number;
  rankTokens: number;
  forgeShards: number;
  /** The guaranteed item's minimum rarity. */
  itemRarity: ItemRarity;
}

export interface AdventureStage {
  id: string;
  /** 0-based position over the whole adventure (0..24). */
  index: number;
  worldIndex: number;
  stageIndex: number;
  name: string;
  isBoss: boolean;
  defenseLevel: number;
  rooms: DungeonRoomCell[];
  reward: AdventureReward;
}

/** Difficulty curve: defense level 2 at the first stage, 60 at the last. */
function stageLevel(index: number): number {
  return Math.round(2 + (index * 58) / (ADVENTURE_WORLDS.length * STAGES_PER_WORLD - 1));
}

function stageReward(index: number, isBoss: boolean, worldIndex: number): AdventureReward {
  const mul = isBoss ? 2 : 1;
  return {
    gold: (100 + index * 50) * mul,
    crystals: (3 + Math.round(index * 0.6)) * mul,
    stardust: (15 + index * 5) * mul,
    rankTokens: (1 + Math.floor(index / 6)) * mul,
    forgeShards: (8 + index * 3) * mul,
    itemRarity: isBoss ? "legendaire" : worldIndex >= 2 ? "epique" : "rare",
  };
}

type Cell = { row: number; col: number };
const key = (c: Cell) => `${c.row},${c.col}`;
const inGrid = (c: Cell) => c.row >= 0 && c.row < GRID_ROWS && c.col >= 0 && c.col < GRID_COLS;

function pick<T>(rng: () => number, list: T[]): T {
  return list[randomInt(rng, 0, list.length - 1)];
}

function squad(rng: () => number, pool: string[], size: number): string[] {
  return Array.from({ length: size }, () => pick(rng, pool));
}

function traps(rng: () => number, pool: string[], size: number): string[] {
  const shuffled = [...pool].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(size, pool.length));
}

/** Main path (entrance excluded) winding left to right, then side rooms off it. */
function buildLayout(stageId: string, world: AdventureWorld, worldIndex: number, stageIndex: number, isBoss: boolean): DungeonRoomCell[] {
  const rng = createRng(`adventure:${stageId}`);
  const pathLength = Math.min(9, 3 + stageIndex + Math.floor(worldIndex / 2));
  const sideRooms = Math.min(4, Math.floor((worldIndex + stageIndex) / 2));
  const monstersPerRoom = 1 + Math.floor((worldIndex + (stageIndex >= 3 ? 1 : 0)) / 2);
  const trapsPerRoom = 1 + Math.floor(worldIndex / 2);
  const trapChance = 0.25 + worldIndex * 0.08;

  const used = new Set([key(ENTRANCE_CELL)]);
  const path: Cell[] = [];
  let cur: Cell = { ...ENTRANCE_CELL };
  while (path.length < pathLength) {
    const right = { row: cur.row, col: cur.col + 1 };
    const verticals = [{ row: cur.row - 1, col: cur.col }, { row: cur.row + 1, col: cur.col }].filter((c) => inGrid(c) && !used.has(key(c)));
    const canRight = inGrid(right) && !used.has(key(right));
    // Wiggle vertically now and then (never twice from the entrance column), keep heading right otherwise.
    const next = verticals.length && cur.col > 0 && (!canRight || rng() < 0.4) ? pick(rng, verticals) : canRight ? right : undefined;
    if (!next) break;
    used.add(key(next));
    path.push(next);
    cur = next;
  }

  const rooms: DungeonRoomCell[] = [{ ...ENTRANCE_CELL, type: "empty" }];
  path.forEach((cell, i) => {
    const last = i === path.length - 1;
    const guardian = i === path.length - 2;
    if (last) rooms.push({ ...cell, type: "treasure" });
    else if (guardian)
      rooms.push({ ...cell, type: "monster", monsterRefIds: isBoss ? [...world.bossSquad] : squad(rng, world.monsterPool.filter((m) => m !== "seigneur-des-ombres"), monstersPerRoom + 1) });
    else if (i > 0 && rng() < trapChance) rooms.push({ ...cell, type: "trap", trapIds: traps(rng, world.trapPool, trapsPerRoom) });
    else if (rng() < 0.7) rooms.push({ ...cell, type: "monster", monsterRefIds: squad(rng, world.monsterPool.filter((m) => m !== "seigneur-des-ombres" || worldIndex === 4), monstersPerRoom) });
    else rooms.push({ ...cell, type: "empty" });
  });

  // Optional detours off the main path (never next to the seal): more fights and traps for
  // whoever wanders, nothing to gain — the fog doesn't say which way the seal is.
  for (let tries = 0, added = 0; added < sideRooms && tries < 30; tries++) {
    const anchor = pick(rng, path.slice(0, Math.max(1, path.length - 2)));
    const options = [
      { row: anchor.row - 1, col: anchor.col },
      { row: anchor.row + 1, col: anchor.col },
    ].filter((c) => inGrid(c) && !used.has(key(c)));
    if (!options.length) continue;
    const cell = pick(rng, options);
    used.add(key(cell));
    added++;
    rooms.push(
      rng() < 0.5
        ? { ...cell, type: "trap", trapIds: traps(rng, world.trapPool, trapsPerRoom) }
        : { ...cell, type: "monster", monsterRefIds: squad(rng, world.monsterPool, monstersPerRoom) },
    );
  }
  return rooms;
}

export const ADVENTURE_STAGES: AdventureStage[] = ADVENTURE_WORLDS.flatMap((world, worldIndex) =>
  world.stageNames.map((name, stageIndex) => {
    const index = worldIndex * STAGES_PER_WORLD + stageIndex;
    const id = `${world.id}-${stageIndex + 1}`;
    const isBoss = stageIndex === STAGES_PER_WORLD - 1;
    return {
      id,
      index,
      worldIndex,
      stageIndex,
      name,
      isBoss,
      defenseLevel: stageLevel(index),
      rooms: buildLayout(id, world, worldIndex, stageIndex, isBoss),
      reward: stageReward(index, isBoss, worldIndex),
    };
  }),
);

export function getAdventureStage(stageIdOrDefenderId: string): AdventureStage {
  const id = stageIdOrDefenderId.startsWith(ADVENTURE_PREFIX) ? stageIdOrDefenderId.slice(ADVENTURE_PREFIX.length) : stageIdOrDefenderId;
  const stage = ADVENTURE_STAGES.find((s) => s.id === id);
  if (!stage) throw new Error(`Donjon d'aventure inconnu: ${id}`);
  return stage;
}

/** A stage is open once the previous one has been cleared (the very first one always is). */
export function isStageUnlocked(stage: AdventureStage, cleared: Record<string, number> | undefined): boolean {
  return stage.index === 0 || !!cleared?.[ADVENTURE_STAGES[stage.index - 1].id];
}
