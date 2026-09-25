"use client";

import { Fragment, useEffect, useRef } from "react";
import type { DungeonRoomContentType, RaidLogEntry } from "@/types/game";

const ROOM_LABEL: Record<DungeonRoomContentType, string> = {
  empty: "Salle vide",
  trap: "⚠️ Salle piégée",
  monster: "👹 Salle de monstres",
  treasure: "💰 Salle au trésor",
};

function entryColor(entry: RaidLogEntry): string {
  if (entry.report) return entry.report.outcome === "cleared" ? "font-semibold text-emerald-300" : "font-semibold text-red-300";
  if (entry.kind === "heal") return "text-emerald-400";
  if (entry.kind === "trap") return "text-orange-400";
  if (entry.kind === "info") return "text-amber-300";
  return entry.side === "enemy" ? "text-red-300" : "text-sky-100";
}

function sideMarker(entry: RaidLogEntry): string {
  if (!entry.side || entry.round === 0 || entry.report) return "border-transparent";
  return entry.side === "hero" ? "border-sky-500/60" : "border-red-500/60";
}

/** The raid's running log: grouped by room, fights split into rounds, each line marked with its camp
 *  (blue = your heroes, red = the enemy) and the spell effect that fired. `entries` are already revealed. */
export function RaidCombatLog({
  entries,
  roomTypes = {},
}: {
  entries: RaidLogEntry[];
  /** "row,col" -> content, for the room headers. */
  roomTypes?: Record<string, DungeonRoomContentType | undefined>;
}) {
  const scrollRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [entries.length]);

  return (
    <ol
      ref={scrollRef}
      className="panel-scrollbar max-h-96 space-y-0.5 overflow-y-auto rounded-lg border border-white/5 bg-black/20 p-3 text-sm"
    >
      {entries.map((entry, i) => {
        const prev = entries[i - 1];
        const newRoom = !prev || prev.roomKey !== entry.roomKey;
        const newRound = entry.round !== undefined && entry.round > 0 && !entry.report && prev?.round !== entry.round;
        return (
          <Fragment key={i}>
            {newRoom && (
              <li className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 first:pt-0">
                {ROOM_LABEL[roomTypes[entry.roomKey] ?? "empty"]}
              </li>
            )}
            {newRound && <li className="pt-1 text-[11px] text-slate-500">— Tour {entry.round} —</li>}
            <li className={`border-l-2 pl-2 ${sideMarker(entry)} ${entryColor(entry)} ${entry.crit ? "font-semibold" : ""}`}>
              {entry.effect && (
                <span className="mr-1 rounded bg-violet-500/20 px-1 py-px text-[10px] font-medium text-violet-200">{entry.effect}</span>
              )}
              {entry.message}
            </li>
          </Fragment>
        );
      })}
      {entries.length === 0 && <li className="text-slate-500">Aucun événement pour l&apos;instant.</li>}
    </ol>
  );
}
