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
  empty: "border-line-strong bg-white/[0.04] text-fg-subtle hover:bg-white/[0.07]",
  trap: "border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/15",
  monster: "border-purple-400/30 bg-purple-400/10 text-purple-300 hover:bg-purple-400/15",
  treasure: "border-amber-300/35 bg-amber-300/10 text-amber-300 hover:bg-amber-300/15",
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
    <div className="grid max-w-md grid-cols-5 gap-1.5 rounded-xl border border-line bg-black/25 p-2">
      {cells.map(({ row, col }) => {
        const key = `${row},${col}`;
        const room = byKey.get(key);
        const isEntrance = row === ENTRANCE_CELL.row && col === ENTRANCE_CELL.col;
        const placeable = !room && rooms.some((r) => isAdjacent(r, { row, col }));
        const selected = key === selectedKey;

        if (!room && !placeable) {
          return <div key={key} className="aspect-square rounded-lg border border-line bg-white/[0.01]" />;
        }

        return (
          <button
            key={key}
            onClick={() => onCellClick(row, col)}
            title={isEntrance ? "Entrée" : undefined}
            aria-label={isEntrance ? "Entrée du donjon" : room ? TYPE_LABEL[room.type] : "Emplacement libre — ajouter une salle"}
            aria-pressed={room ? selected : undefined}
            className={`flex aspect-square items-center justify-center rounded-lg border text-lg transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out active:scale-[0.97] ${focusRing} ${
              room
                ? TYPE_STYLE[room.type]
                : "border-dashed border-line-strong text-fg-faint hover:border-gold/40 hover:bg-gold/[0.06] hover:text-gold"
            } ${selected ? "ring-2 ring-gold/60" : ""}`}
          >
            {isEntrance ? (
              "🚪"
            ) : room?.type === "treasure" ? (
              <Icon name="treasure" className="h-4 w-4" />
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
