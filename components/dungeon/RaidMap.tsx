"use client";

import { GRID_COLS, GRID_ROWS } from "@/lib/game/content/dungeon";
import { focusRing } from "@/lib/ui/a11y";
import { Icon } from "@/components/Icon";
import type { RaidRoomView } from "@/types/game";

const TYPE_ICON: Record<string, string> = {
  empty: "·",
  trap: "⚠️",
  monster: "👹",
  treasure: "💰",
};

/** Fog-of-war raid map: visited rooms show their content, adjacent unvisited rooms are clickable "?" tiles, everything else is hidden. */
export function RaidMap({
  rooms,
  currentRoom,
  onEnterRoom,
  disabled,
}: {
  rooms: RaidRoomView[];
  currentRoom: { row: number; col: number };
  onEnterRoom: (row: number, col: number) => void;
  disabled: boolean;
}) {
  const byKey = new Map(rooms.map((r) => [`${r.row},${r.col}`, r]));
  const cells: { row: number; col: number }[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) cells.push({ row, col });
  }

  return (
    <div className="grid max-w-md grid-cols-5 gap-1.5">
      {cells.map(({ row, col }) => {
        const key = `${row},${col}`;
        const view = byKey.get(key);
        const isCurrent = currentRoom.row === row && currentRoom.col === col;

        if (!view) {
          return <div key={key} className="aspect-square rounded-lg border border-white/5 bg-black/10" />;
        }

        if (!view.visited) {
          return (
            <button
              key={key}
              disabled={disabled}
              onClick={() => onEnterRoom(row, col)}
              aria-label={`Salle inconnue en ligne ${row + 1}, colonne ${col + 1} — explorer`}
              className={`aspect-square animate-pulse rounded-lg border border-dashed border-amber-400/50 bg-amber-500/10 text-lg text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
            >
              ?
            </button>
          );
        }

        return (
          <div
            key={key}
            title={
              view.trapChargesRemaining !== undefined
                ? `${view.trapChargesRemaining} charge(s) restante(s)`
                : undefined
            }
            className={`relative flex aspect-square items-center justify-center rounded-lg border text-lg ${
              isCurrent
                ? "border-amber-400 bg-amber-500/20 ring-2 ring-amber-400"
                : "border-white/15 bg-black/20"
            }`}
          >
            {view.type === "empty" ? (
              isCurrent ? (
                "🧍"
              ) : (
                "·"
              )
            ) : view.type === "treasure" ? (
              <Icon name="treasure" className="h-4 w-4" />
            ) : (
              TYPE_ICON[view.type ?? "empty"]
            )}
            {view.type === "trap" && view.trapChargesRemaining !== undefined && (
              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[10px] text-red-300">
                {view.trapChargesRemaining}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
