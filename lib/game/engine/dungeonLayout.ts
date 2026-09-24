// Pure grid/adjacency helpers shared by the defense-builder validation, the
// raid fog-of-war projection, and bot-dungeon generation.

import {
  ENTRANCE_CELL,
  GRID_COLS,
  GRID_ROWS,
  MAX_TREASURE_ROOMS,
  MIN_TREASURE_ROOMS,
} from "@/lib/game/content/dungeon";
import type { DungeonRoomCell } from "@/types/game";

export interface Cell {
  row: number;
  col: number;
}

export function roomKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}

export function inBounds(cell: Cell): boolean {
  return cell.row >= 0 && cell.row < GRID_ROWS && cell.col >= 0 && cell.col < GRID_COLS;
}

export function neighborsOf(cell: Cell): Cell[] {
  const candidates: Cell[] = [
    { row: cell.row - 1, col: cell.col },
    { row: cell.row + 1, col: cell.col },
    { row: cell.row, col: cell.col - 1 },
    { row: cell.row, col: cell.col + 1 },
  ];
  return candidates.filter(inBounds);
}

export function isAdjacent(a: Cell, b: Cell): boolean {
  const dRow = Math.abs(a.row - b.row);
  const dCol = Math.abs(a.col - b.col);
  return dRow + dCol === 1;
}

/** BFS from the entrance over the set of placed cells. Returns the subset unreachable from it (empty = fully connected). */
export function findDisconnectedRooms(rooms: DungeonRoomCell[]): DungeonRoomCell[] {
  const byKey = new Map(rooms.map((r) => [roomKey(r), r]));
  const entranceRoom = byKey.get(roomKey(ENTRANCE_CELL));
  if (!entranceRoom) return rooms;

  const visited = new Set<string>([roomKey(ENTRANCE_CELL)]);
  const queue: Cell[] = [ENTRANCE_CELL];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of neighborsOf(current)) {
      const key = roomKey(neighbor);
      if (visited.has(key) || !byKey.has(key)) continue;
      visited.add(key);
      queue.push(neighbor);
    }
  }

  return rooms.filter((r) => !visited.has(roomKey(r)));
}

export type LayoutValidationResult = { ok: true } | { ok: false; reason: string };

export function validateDungeonLayout(rooms: DungeonRoomCell[]): LayoutValidationResult {
  const entranceRoom = rooms.find(
    (r) => r.row === ENTRANCE_CELL.row && r.col === ENTRANCE_CELL.col,
  );
  if (!entranceRoom) return { ok: false, reason: "La salle d'entrée est manquante" };
  if (entranceRoom.type !== "empty") {
    return { ok: false, reason: "La salle d'entrée doit rester vide" };
  }

  const seen = new Set<string>();
  for (const room of rooms) {
    if (!inBounds(room)) return { ok: false, reason: "Une salle est hors de la grille" };
    const key = roomKey(room);
    if (seen.has(key)) return { ok: false, reason: "Deux salles occupent la même case" };
    seen.add(key);
  }

  if (findDisconnectedRooms(rooms).length > 0) {
    return { ok: false, reason: "Toutes les salles doivent être reliées à l'entrée" };
  }

  const treasureRoomCount = rooms.filter((r) => r.type === "treasure").length;
  if (treasureRoomCount < MIN_TREASURE_ROOMS || treasureRoomCount > MAX_TREASURE_ROOMS) {
    return {
      ok: false,
      reason: `Le donjon doit avoir entre ${MIN_TREASURE_ROOMS} et ${MAX_TREASURE_ROOMS} salle(s) au trésor`,
    };
  }

  return { ok: true };
}
