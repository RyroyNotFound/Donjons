"use client";

import { useEffect, useState } from "react";
import { callApi } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Spinner } from "@/components/Spinner";
import { ZONES } from "@/lib/game/content/zones";
import type { LeaderboardCategory, LeaderboardEntry, LeaderboardResponse } from "@/types/game";

// Mirrors POWER_TEAM_SIZE in lib/game/leaderboard.ts (server-only, so not importable here).
const TEAM_SIZE = Math.max(...ZONES.map((z) => z.heroSlots));

const CATEGORIES: { id: LeaderboardCategory; label: string; unit: string; hint: string }[] = [
  {
    id: "power",
    label: "⚔️ Puissance",
    unit: "puissance",
    hint: `Puissance cumulée de tes ${TEAM_SIZE} meilleurs héros (stats, équipement, talents, rangs).`,
  },
  {
    id: "expeditions",
    label: "🗺️ Expéditions",
    unit: "★",
    hint: "Total des meilleures étoiles obtenues sur chaque zone. Départage : nombre de victoires.",
  },
  {
    id: "raids",
    label: "🛡️ Raids",
    unit: "pts",
    hint: "3 pts par donjon de joueur vaincu, 2 par attaque repoussée, 1 par repaire vaincu. Départage : butin pillé.",
  },
  {
    id: "collection",
    label: "🔮 Collection",
    unit: "pièces",
    hint: "Classes, sorts, talents et maîtrises débloqués. Départage : rangs cumulés.",
  },
];

const PODIUM = ["text-amber-300", "text-slate-200", "text-orange-400"];

function EntryRow({ entry, unit, isMe }: { entry: LeaderboardEntry; unit: string; isMe: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        isMe ? "border-amber-500/50 bg-amber-500/10" : "border-white/5 bg-black/20"
      }`}
    >
      <span
        className={`font-display w-8 shrink-0 text-center text-lg font-bold ${
          PODIUM[entry.rank - 1] ?? "text-slate-500"
        }`}
      >
        {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : entry.rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-100">
          {entry.displayName}
          {isMe && <span className="ml-2 text-xs font-normal text-amber-300">(toi)</span>}
        </p>
        <p className="truncate text-xs text-slate-500">{entry.detail}</p>
      </div>
      <span className="shrink-0 text-right font-semibold tabular-nums text-slate-100">
        {entry.score.toLocaleString("fr-FR")} <span className="text-xs font-normal text-slate-400">{unit}</span>
      </span>
    </li>
  );
}

export default function ClassementPage() {
  const { user } = useAuth();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [category, setCategory] = useState<LeaderboardCategory>("power");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callApi<LeaderboardResponse>("/api/leaderboard", undefined, "GET")
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  const meta = CATEGORIES.find((c) => c.id === category)!;
  const board = data?.categories[category];
  const meInTop = board?.me && board.top.some((e) => e.uid === board.me!.uid);

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Classement"
          subtitle={
            data
              ? `${data.playerCount} aventurier${data.playerCount > 1 ? "s" : ""} classé${data.playerCount > 1 ? "s" : ""} · mis à jour chaque minute`
              : "Qui règne sur les donjons ?"
          }
        />

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c.id} selected={category === c.id} onClick={() => setCategory(c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>

        {error && <p className="text-red-400">{error}</p>}
        {!data && !error && <Spinner label="Calcul du classement..." />}

        {board && (
          <Card textured>
            <p className="mb-4 text-sm text-slate-400">{meta.hint}</p>
            {board.me && (
              <p className="mb-4 text-sm text-slate-300">
                Ta place : <span className="font-semibold text-amber-300">#{board.me.rank}</span> sur{" "}
                {data!.playerCount}
              </p>
            )}
            <ol className="space-y-1.5">
              {board.top.map((entry) => (
                <EntryRow key={entry.uid} entry={entry} unit={meta.unit} isMe={entry.uid === user?.uid} />
              ))}
            </ol>
            {board.me && !meInTop && (
              <>
                <p className="my-2 text-center text-slate-600">⋯</p>
                <ol>
                  <EntryRow entry={board.me} unit={meta.unit} isMe />
                </ol>
              </>
            )}
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
