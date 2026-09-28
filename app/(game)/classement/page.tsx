"use client";

import { useEffect, useState } from "react";
import { callApi } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Badge } from "@/components/Badge";
import { NavIcon, type NavIconName } from "@/components/NavIcon";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Spinner } from "@/components/Spinner";
import { focusRing } from "@/lib/ui/a11y";
import { ZONES } from "@/lib/game/content/zones";
import type { LeaderboardCategory, LeaderboardEntry, LeaderboardResponse } from "@/types/game";

// Mirrors POWER_TEAM_SIZE in lib/game/leaderboard.ts (server-only, so not importable here).
const TEAM_SIZE = Math.max(...ZONES.map((z) => z.heroSlots));

const CATEGORIES: { id: LeaderboardCategory; label: string; icon: NavIconName; unit: string; hint: string }[] = [
  {
    id: "power",
    label: "Puissance",
    icon: "attack",
    unit: "puissance",
    hint: `Puissance cumulée de tes ${TEAM_SIZE} meilleurs héros (stats, équipement, talents, rangs).`,
  },
  {
    id: "expeditions",
    label: "Expéditions",
    icon: "map",
    unit: "★",
    hint: "Total des meilleures étoiles obtenues sur chaque zone. Départage : nombre de victoires.",
  },
  {
    id: "raids",
    label: "Raids",
    icon: "dungeon",
    unit: "pts",
    hint: "3 pts par donjon de joueur vaincu, 2 par attaque repoussée, 1 par repaire vaincu. Départage : butin pillé.",
  },
  {
    id: "collection",
    label: "Collection",
    icon: "summon",
    unit: "pièces",
    hint: "Classes, sorts, talents et maîtrises débloqués. Départage : rangs cumulés.",
  },
];

/** Gold / silver / bronze tint for the top 3 rank numbers only. */
const PODIUM = ["text-gold", "text-zinc-300", "text-orange-300"];

const listClass = "divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface";

function EntryRow({ entry, unit, isMe }: { entry: LeaderboardEntry; unit: string; isMe: boolean }) {
  return (
    <li
      aria-current={isMe ? "true" : undefined}
      className={`flex items-center gap-3 px-4 py-3 ${
        isMe ? "bg-gold/[0.06] shadow-[inset_2px_0_0_var(--color-gold)]" : ""
      }`}
    >
      <span
        className={`w-7 shrink-0 text-right text-sm font-semibold tabular-nums ${
          PODIUM[entry.rank - 1] ?? "text-fg-subtle"
        }`}
      >
        {entry.rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-fg">
          <span className="truncate">{entry.displayName}</span>
          {isMe && (
            <Badge tone="gold" className="shrink-0">
              toi
            </Badge>
          )}
        </p>
        <p className="mt-0.5 truncate text-xs text-fg-subtle">{entry.detail}</p>
      </div>
      <span className="shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-fg">
        {entry.score.toLocaleString("fr-FR")} <span className="text-xs font-normal text-fg-subtle">{unit}</span>
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
      <div className="space-y-8">
        <PageHeader
          title="Classement"
          subtitle={
            data
              ? `${data.playerCount} aventurier${data.playerCount > 1 ? "s" : ""} classé${data.playerCount > 1 ? "s" : ""} · mis à jour chaque minute`
              : "Qui règne sur les donjons ?"
          }
        />

        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="inline-flex rounded-lg border border-line bg-white/[0.02] p-1">
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(c.id)}
                  className={`flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97] ${focusRing} ${
                    active
                      ? "bg-surface-3 text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                      : "text-fg-muted hover:text-fg"
                  }`}
                >
                  <NavIcon name={c.icon} className={`h-4 w-4 ${active ? "text-gold" : "text-fg-subtle"}`} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        {!data && !error && <Spinner label="Calcul du classement..." />}

        {board && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p className="max-w-2xl text-sm leading-relaxed text-fg-muted">{meta.hint}</p>
              {board.me && (
                <p className="shrink-0 text-sm text-fg-muted">
                  Ta place : <span className="font-semibold tabular-nums text-gold">#{board.me.rank}</span> sur{" "}
                  <span className="tabular-nums">{data!.playerCount}</span>
                </p>
              )}
            </div>
            <div key={category} className="animate-rise space-y-2">
              <ol className={listClass}>
                {board.top.map((entry) => (
                  <EntryRow key={entry.uid} entry={entry} unit={meta.unit} isMe={entry.uid === user?.uid} />
                ))}
              </ol>
              {board.me && !meInTop && (
                <>
                  <p aria-hidden className="text-center text-sm leading-none text-fg-faint">
                    ⋯
                  </p>
                  <ol className={listClass}>
                    <EntryRow entry={board.me} unit={meta.unit} isMe />
                  </ol>
                </>
              )}
            </div>
          </section>
        )}
      </div>
    </PageTransition>
  );
}
