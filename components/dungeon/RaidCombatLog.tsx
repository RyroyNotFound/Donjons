"use client";

import { useEffect, useRef, useState } from "react";
import type { RaidLogEntry } from "@/types/game";

const KIND_COLOR: Record<RaidLogEntry["kind"], string> = {
  attack: "text-slate-300",
  heal: "text-emerald-400",
  trap: "text-red-400",
  info: "text-amber-300",
};

const REVEAL_INTERVAL_MS = 220;

/** Reveals newly-appended log entries one at a time instead of dumping the whole round at once. */
export function RaidCombatLog({ entries }: { entries: RaidLogEntry[] }) {
  const [revealedCount, setRevealedCount] = useState(entries.length);
  const scrollRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (revealedCount >= entries.length) return;
    const timeout = setTimeout(() => setRevealedCount((c) => Math.min(entries.length, c + 1)), REVEAL_INTERVAL_MS);
    return () => clearTimeout(timeout);
  }, [entries.length, revealedCount]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [revealedCount]);

  const visible = entries.slice(0, revealedCount);

  return (
    <ol
      ref={scrollRef}
      className="panel-scrollbar max-h-80 space-y-1 overflow-y-auto rounded-lg border border-white/5 bg-black/20 p-3 text-sm"
    >
      {visible.map((entry, i) => (
        <li key={i} className={KIND_COLOR[entry.kind]}>
          {entry.message}
        </li>
      ))}
      {visible.length === 0 && <li className="text-slate-500">Aucun événement pour l&apos;instant.</li>}
    </ol>
  );
}
