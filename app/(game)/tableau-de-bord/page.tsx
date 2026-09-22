"use client";

import Link from "next/link";
import { useGameData } from "@/lib/game/GameDataProvider";
import { Card } from "@/components/Card";
import { getZone } from "@/lib/game/content/zones";

export default function TableauDeBordPage() {
  const { profile, heroes, dungeon, expeditions } = useGameData();

  const activeExpeditions = expeditions.filter((e) => e.status === "active");
  const idleHeroes = heroes.filter((h) => h.status === "idle");
  const configuredRooms = dungeon?.rooms.filter((r) => r.kind !== "empty").length ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-50">
        Bienvenue, {profile?.displayName ?? "aventurier"}
      </h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-zinc-400">Héros disponibles</p>
          <p className="text-3xl font-bold text-zinc-50">
            {idleHeroes.length}/{heroes.length}
          </p>
          <Link href="/heros" className="mt-2 inline-block text-sm text-amber-400 hover:underline">
            Voir la garnison →
          </Link>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Salles configurées</p>
          <p className="text-3xl font-bold text-zinc-50">{configuredRooms}/3</p>
          <Link href="/donjon" className="mt-2 inline-block text-sm text-amber-400 hover:underline">
            Configurer le donjon →
          </Link>
        </Card>
        <Card>
          <p className="text-sm text-zinc-400">Expéditions en cours</p>
          <p className="text-3xl font-bold text-zinc-50">{activeExpeditions.length}</p>
          <Link href="/expeditions" className="mt-2 inline-block text-sm text-amber-400 hover:underline">
            Gérer les expéditions →
          </Link>
        </Card>
      </div>

      {activeExpeditions.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold text-zinc-50">Expéditions en cours</h2>
          <ul className="space-y-2">
            {activeExpeditions.map((exp) => {
              const zone = getZone(exp.zoneId);
              return (
                <li key={exp.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{zone.name}</span>
                  <Link
                    href={`/expeditions/jouer/${exp.id}`}
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
  );
}
