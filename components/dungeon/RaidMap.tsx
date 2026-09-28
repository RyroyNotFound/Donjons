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

const TILE_MOTION = "transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97]";

/** Fog-of-war raid map: visited rooms show their content, adjacent unvisited rooms are clickable "?" tiles
 *  (showing their content when a scout revealed it), visited rooms next to the party can be walked back
 *  through (a trap with charges left fires again), everything else is hidden. */
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
    <div className="grid max-w-md grid-cols-5 gap-1.5 rounded-xl border border-line bg-black/25 p-2">
      {cells.map(({ row, col }) => {
        const key = `${row},${col}`;
        const view = byKey.get(key);
        const isCurrent = currentRoom.row === row && currentRoom.col === col;

        if (!view) {
          return <div key={key} className="aspect-square rounded-lg border border-line bg-white/[0.01]" />;
        }

        if (!view.visited) {
          const scoutedIcon = view.scouted && view.type ? (view.type === "empty" ? "·" : TYPE_ICON[view.type]) : null;
          return (
            <button
              key={key}
              disabled={disabled}
              onClick={() => onEnterRoom(row, col)}
              aria-label={`Salle ${scoutedIcon ? "repérée" : "inconnue"} en ligne ${row + 1}, colonne ${col + 1} — explorer`}
              title={view.scouted ? `Repérée par l'éclaireur${view.occupantCount ? ` : ${view.occupantCount} occupant(s)` : ""}` : undefined}
              className={`relative flex aspect-square items-center justify-center rounded-lg border border-dashed border-gold/35 bg-gold/[0.05] text-lg text-gold/80 hover:border-gold/60 hover:bg-gold/10 hover:text-gold disabled:cursor-not-allowed disabled:opacity-50 ${TILE_MOTION} ${focusRing}`}
            >
              {scoutedIcon ?? "?"}
              {view.occupantCount ? (
                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[10px] tabular-nums text-gold">
                  ×{view.occupantCount}
                </span>
              ) : null}
            </button>
          );
        }

        const adjacent = Math.abs(currentRoom.row - row) + Math.abs(currentRoom.col - col) === 1;
        const Tag = adjacent ? "button" : "div";

        return (
          <Tag
            key={key}
            {...(adjacent
              ? { onClick: () => onEnterRoom(row, col), disabled, "aria-label": `Revenir en ligne ${row + 1}, colonne ${col + 1}` }
              : {})}
            title={
              view.trapChargesRemaining !== undefined
                ? `${view.trapChargesRemaining} charge(s) restante(s)`
                : undefined
            }
            className={`relative flex aspect-square items-center justify-center rounded-lg border text-lg ${
              isCurrent
                ? "border-gold/50 bg-gold/15 ring-2 ring-gold/60"
                : adjacent
                  ? `border-line-strong bg-white/[0.04] text-fg-muted hover:bg-white/[0.08] disabled:cursor-not-allowed ${TILE_MOTION} ${focusRing}`
                  : "border-line bg-white/[0.025] text-fg-subtle"
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
              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[10px] tabular-nums text-red-300">
                {view.trapChargesRemaining}
              </span>
            )}
          </Tag>
        );
      })}
    </div>
  );
}
