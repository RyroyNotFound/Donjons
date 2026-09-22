"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { ZONES } from "@/lib/game/content/zones";
import { Card } from "@/components/Card";

export default function ExpeditionsPage() {
  const router = useRouter();
  const { heroes, expeditions } = useGameData();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedHeroes, setSelectedHeroes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [abandoningId, setAbandoningId] = useState<string | null>(null);

  const idleHeroes = heroes.filter((h) => h.status === "idle");
  const zone = selectedZone ? ZONES.find((z) => z.id === selectedZone) : undefined;
  const activeExpeditions = expeditions.filter((e) => e.status === "active");

  function toggleHero(heroId: string) {
    if (!zone) return;
    setSelectedHeroes((prev) => {
      if (prev.includes(heroId)) return prev.filter((id) => id !== heroId);
      if (prev.length >= zone.heroSlots) return prev;
      return [...prev, heroId];
    });
  }

  async function start() {
    if (!selectedZone || selectedHeroes.length === 0) return;
    setError(null);
    setStarting(true);
    try {
      const res = await callApi<{ expeditionId: string }>("/api/expeditions/start", {
        zoneId: selectedZone,
        heroIds: selectedHeroes,
      });
      router.push(`/expeditions/jouer/${res.expeditionId}`);
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  }

  async function abandon(expeditionId: string) {
    setError(null);
    setAbandoningId(expeditionId);
    try {
      await callApi("/api/expeditions/abandon", { expeditionId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAbandoningId(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-50">Expéditions de farm</h1>

      {activeExpeditions.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold text-zinc-50">En cours</h2>
          <ul className="space-y-2">
            {activeExpeditions.map((exp) => {
              const expZone = ZONES.find((z) => z.id === exp.zoneId)!;
              return (
                <li key={exp.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">
                    {expZone.name} — {exp.heroIds.length} héros
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/expeditions/jouer/${exp.id}`}
                      className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
                    >
                      Reprendre
                    </Link>
                    <button
                      onClick={() => abandon(exp.id)}
                      disabled={abandoningId === exp.id}
                      className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      {abandoningId === exp.id ? "..." : "Abandonner"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {ZONES.map((z) => (
          <Card
            key={z.id}
            className={`cursor-pointer transition ${
              selectedZone === z.id ? "border-amber-500" : ""
            }`}
          >
            <button
              className="w-full text-left"
              onClick={() => {
                setSelectedZone(z.id);
                setSelectedHeroes([]);
              }}
            >
              <p className="font-semibold text-zinc-50">{z.name}</p>
              <p className="text-sm text-zinc-400">{z.description}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {z.durationSec}s · {z.heroSlots} héros max · difficulté {z.difficulty}
              </p>
            </button>
          </Card>
        ))}
      </div>

      {zone && (
        <Card>
          <h2 className="mb-3 font-semibold text-zinc-50">
            Équipe pour {zone.name} ({selectedHeroes.length}/{zone.heroSlots})
          </h2>
          <div className="flex flex-wrap gap-2">
            {idleHeroes.map((hero) => (
              <button
                key={hero.id}
                onClick={() => toggleHero(hero.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  selectedHeroes.includes(hero.id)
                    ? "border-amber-500 bg-amber-500/20 text-amber-300"
                    : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {hero.name} (Nv.{hero.level})
              </button>
            ))}
          </div>
          {idleHeroes.length === 0 && (
            <p className="mt-2 text-sm text-zinc-500">Aucun héros disponible.</p>
          )}
          <button
            onClick={start}
            disabled={starting || selectedHeroes.length === 0}
            className="mt-4 rounded-lg bg-amber-500 px-4 py-2 font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {starting ? "Départ..." : "Entrer dans l'arène"}
          </button>
        </Card>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
