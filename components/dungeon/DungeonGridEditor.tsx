"use client";

import { ENTRANCE_CELL, GRID_COLS, GRID_ROWS } from "@/lib/game/content/dungeon";
import { isAdjacent, roomKey } from "@/lib/game/engine/dungeonLayout";
import { focusRing } from "@/lib/ui/a11y";
import { Icon } from "@/components/Icon";
import type { DungeonRoomCell } from "@/types/game";

const TYPE_ICON: Record<DungeonRoomCell["type"], string> = {
  empty: "·",
  trap: "⚠️",
  monster: "👹",
  treasure: "💰",
};

const TYPE_LABEL: Record<DungeonRoomCell["type"], string> = {
  empty: "Salle vide",
  trap: "Salle piège",
  monster: "Salle monstre",
  treasure: "Salle au trésor",
};

const TYPE_STYLE: Record<DungeonRoomCell["type"], string> = {
  empty: "border-white/15 bg-black/20 text-slate-500",
  trap: "border-red-500/40 bg-red-500/10 text-red-300",
  monster: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  treasure: "border-amber-500/50 bg-amber-500/10 text-amber-300",
};

/** Clickable grid editor: click an empty cell adjacent to a placed room to add one, click a placed room to select it. */
export function DungeonGridEditor({
  rooms,
  selectedKey,
  onCellClick,
}: {
  rooms: DungeonRoomCell[];
  selectedKey: string | null;
  onCellClick: (row: number, col: number) => void;
}) {
  const byKey = new Map(rooms.map((r) => [roomKey(r), r]));
  const cells: { row: number; col: number }[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) cells.push({ row, col });
  }

  return (
    <div className="grid max-w-md grid-cols-5 gap-1.5">
      {cells.map(({ row, col }) => {
        const key = `${row},${col}`;
        const room = byKey.get(key);
        const isEntrance = row === ENTRANCE_CELL.row && col === ENTRANCE_CELL.col;
        const placeable = !room && rooms.some((r) => isAdjacent(r, { row, col }));
        const selected = key === selectedKey;

        if (!room && !placeable) {
          return <div key={key} className="aspect-square rounded-lg border border-white/5 bg-black/10" />;
        }

        return (
          <button
            key={key}
            onClick={() => onCellClick(row, col)}
            title={isEntrance ? "Entrée" : undefined}
            aria-label={isEntrance ? "Entrée du donjon" : room ? TYPE_LABEL[room.type] : "Emplacement libre — ajouter une salle"}
            aria-pressed={room ? selected : undefined}
            className={`aspect-square rounded-lg border text-lg transition ${focusRing} ${
              room
                ? TYPE_STYLE[room.type]
                : "border-dashed border-white/20 bg-white/5 text-slate-500 hover:bg-white/10"
            } ${selected ? "ring-2 ring-amber-400" : ""}`}
          >
            {isEntrance ? (
              "🚪"
            ) : room?.type === "treasure" ? (
              <Icon name="treasure" className="mx-auto h-4 w-4" />
            ) : room ? (
              TYPE_ICON[room.type]
            ) : (
              "+"
            )}
          </button>
        );
      })}
    </div>
  );
}
