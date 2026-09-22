"use client";

import { useState } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { ZONES } from "@/lib/game/content/zones";
import { Card } from "@/components/Card";
import { Countdown } from "@/components/Countdown";
import type { ExpeditionLootResult } from "@/lib/game/engine/loot";

export default function ExpeditionsPage() {
  const { heroes, expeditions } = useGameData();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedHeroes, setSelectedHeroes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [lastLoot, setLastLoot] = useState<ExpeditionLootResult | null>(null);

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
      await callApi("/api/expeditions/start", { zoneId: selectedZone, heroIds: selectedHeroes });
      setSelectedHeroes([]);
      setSelectedZone(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function claim(expeditionId: string) {
    setError(null);
    try {
      const res = await callApi<{ loot: ExpeditionLootResult }>("/api/expeditions/claim", {
        expeditionId,
      });
      setLastLoot(res.loot);
    } catch (e) {
      setError((e as Error).message);
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
              const readyAt = exp.startedAt + exp.durationSec * 1000;
              return (
                <li key={exp.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300">
                    {expZone.name} — {exp.heroIds.length} héros
                  </span>
                  <ExpeditionAction readyAt={readyAt} onClaim={() => claim(exp.id)} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {lastLoot && (
        <Card>
          <p className="text-sm text-emerald-400">
            Butin récupéré : {lastLoot.gold} or
            {Object.entries(lastLoot.resources)
              .map(([k, v]) => `, ${v} ${k}`)
              .join("")}
            {lastLoot.item && `, objet trouvé : ${lastLoot.item.name} (${lastLoot.item.rarity})`}
            {lastLoot.monsterCaptured && `, monstre capturé !`}
          </p>
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
                {Math.round(z.durationSec / 60)} min · {z.heroSlots} héros max · difficulté {z.difficulty}
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
            {starting ? "Départ..." : "Envoyer l'équipe"}
          </button>
        </Card>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

function ExpeditionAction({ readyAt, onClaim }: { readyAt: number; onClaim: () => void }) {
  const [ready, setReady] = useState(() => Date.now() >= readyAt);

  if (ready) {
    return (
      <button
        onClick={onClaim}
        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
      >
        Récupérer le butin
      </button>
    );
  }

  return (
    <span className="text-amber-400">
      <Countdown readyAt={readyAt} onReady={() => setReady(true)} />
    </span>
  );
}
