"use client";

import Link from "next/link";
import { useGameData } from "@/lib/game/GameDataProvider";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { getZone } from "@/lib/game/content/zones";
import { maxRoomsForLevel } from "@/lib/game/content/dungeonUpgrades";

export default function TableauDeBordPage() {
  const { profile, heroes, dungeon, dungeonUpgrades, expeditions } = useGameData();

  const activeExpeditions = expeditions.filter((e) => e.status === "active");
  const idleHeroes = heroes.filter((h) => h.status === "idle");
  const configuredRooms = dungeon?.roomCount ?? 0;
  const maxRooms = maxRoomsForLevel(dungeonUpgrades?.levels.expansion ?? 0);

  return (
    <PageTransition>
    <div className="space-y-6">
      <PageHeader
        title={`Bienvenue, ${profile?.displayName ?? "aventurier"}`}
        subtitle="Voici l'état de votre camp aujourd'hui."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="animate-rise" style={{ "--delay": "0s" } as React.CSSProperties}>
          <Card interactive accent="gold" className="h-full">
            <p className="text-sm text-slate-400">Héros disponibles</p>
            <p className="font-display mt-1 text-3xl font-bold text-slate-50">
              {idleHeroes.length}/{heroes.length}
            </p>
            <Link
              href="/heros"
              transitionTypes={["nav-forward"]}
              className="mt-2 inline-block text-sm text-amber-400 hover:underline"
            >
              Voir la garnison →
            </Link>
          </Card>
        </div>
        <div className="animate-rise" style={{ "--delay": "0.08s" } as React.CSSProperties}>
          <Card interactive accent="rare" className="h-full">
            <p className="text-sm text-slate-400">Salles configurées</p>
            <p className="font-display mt-1 text-3xl font-bold text-slate-50">
              {configuredRooms}/{maxRooms}
            </p>
            <Link
              href="/donjon"
              transitionTypes={["nav-forward"]}
              className="mt-2 inline-block text-sm text-amber-400 hover:underline"
            >
              Configurer le donjon →
            </Link>
          </Card>
        </div>
        <div className="animate-rise" style={{ "--delay": "0.16s" } as React.CSSProperties}>
          <Card interactive accent="epique" className="h-full">
            <p className="text-sm text-slate-400">Expéditions en cours</p>
            <p className="font-display mt-1 text-3xl font-bold text-slate-50">{activeExpeditions.length}</p>
            <Link
              href="/expeditions"
              transitionTypes={["nav-forward"]}
              className="mt-2 inline-block text-sm text-amber-400 hover:underline"
            >
              Gérer les expéditions →
            </Link>
          </Card>
        </div>
      </div>

      {activeExpeditions.length > 0 && (
        <Card>
          <h2 className="font-display mb-3 font-semibold text-slate-50">Expéditions en cours</h2>
          <ul className="space-y-2">
            {activeExpeditions.map((exp) => {
              const zone = getZone(exp.zoneId);
              return (
                <li
                  key={exp.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">{zone.name}</span>
                  <Link
                    href={`/expeditions/jouer/${exp.id}`}
                    transitionTypes={["nav-forward"]}
                    className="text-amber-400 hover:underline"
                  >
                    Reprendre →
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
    </PageTransition>
  );
}
