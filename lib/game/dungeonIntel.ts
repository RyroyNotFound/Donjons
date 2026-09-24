// Client-safe "scouting report" of a dungeon, shown on the raid target list so attackers can prepare
// a matching team (trap resistance/disarm vs trap dungeons, elemental resistances vs elemental
// threats, a healer for long crawls). It deliberately reveals counts and elements, never the layout:
// the fog of war stays the defender's edge.

import { getMonster, getTrap } from "@/lib/game/content/dungeon";
import { ELEMENTS, RES_KEY } from "@/lib/game/engine/elements";
import type { Dungeon, Element } from "@/types/game";

export interface DungeonIntel {
  defenseLevel: number;
  roomCount: number;
  treasureRooms: number;
  trapRooms: number;
  traps: number;
  monsterRooms: number;
  monsters: number;
  hasBoss: boolean;
  garrison: number;
  /** Elements the dungeon's traps deal. */
  trapElements: Element[];
  /** Elements the dungeon's monsters attack with. */
  monsterElements: Element[];
  /** Elements at least half of the dungeon's monsters are weak to — the affinity to bring. */
  monsterWeaknesses: Element[];
}

export function dungeonIntel(dungeon: Pick<Dungeon, "rooms" | "garrisonHeroIds" | "defenseLevel">): DungeonIntel {
  const trapIds = dungeon.rooms.flatMap((r) => (r.type === "trap" ? (r.trapIds ?? []) : []));
  const monsterIds = dungeon.rooms.flatMap((r) => (r.type === "monster" ? (r.monsterRefIds ?? []) : []));
  const trapEls = new Set(trapIds.map((id) => getTrap(id).element).filter(Boolean));
  const monsterEls = new Set(monsterIds.map((id) => getMonster(id).element).filter(Boolean));
  return {
    defenseLevel: dungeon.defenseLevel ?? 1,
    roomCount: dungeon.rooms.length - 1,
    treasureRooms: dungeon.rooms.filter((r) => r.type === "treasure").length,
    trapRooms: dungeon.rooms.filter((r) => r.type === "trap").length,
    traps: trapIds.length,
    monsterRooms: dungeon.rooms.filter((r) => r.type === "monster").length,
    monsters: monsterIds.length,
    hasBoss: monsterIds.some((id) => getMonster(id).isBoss),
    garrison: dungeon.garrisonHeroIds.length,
    trapElements: ELEMENTS.filter((e) => trapEls.has(e)),
    monsterElements: ELEMENTS.filter((e) => monsterEls.has(e)),
    monsterWeaknesses:
      monsterIds.length === 0
        ? []
        : ELEMENTS.filter((e) => monsterIds.filter((id) => (getMonster(id).stats[RES_KEY[e]] as number) < 0).length * 2 >= monsterIds.length),
  };
}
