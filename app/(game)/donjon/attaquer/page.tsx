"use client";

import { useEffect, useState } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { Card } from "@/components/Card";
import type { BattleLog } from "@/types/game";

interface Target {
  ownerId: string;
  displayName: string;
  roomCount: number;
  hasBoss: boolean;
  pointsSpent: number;
}

export default function AttaquerPage() {
  const { heroes } = useGameData();
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedHeroes, setSelectedHeroes] = useState<string[]>([]);
  const [battleLog, setBattleLog] = useState<BattleLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [attacking, setAttacking] = useState(false);

  const idleHeroes = heroes.filter((h) => h.status === "idle");

  useEffect(() => {
    callApi<{ targets: Target[] }>("/api/dungeon/targets", undefined, "GET")
      .then((res) => setTargets(res.targets))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingTargets(false));
  }, []);

  function toggleHero(heroId: string) {
    setSelectedHeroes((prev) =>
      prev.includes(heroId) ? prev.filter((id) => id !== heroId) : [...prev, heroId],
    );
  }

  async function attack() {
    if (!selectedTarget || selectedHeroes.length === 0) return;
    setError(null);
    setAttacking(true);
    setBattleLog(null);
    try {
      const res = await callApi<{ battleLog: BattleLog }>("/api/dungeon/attack", {
        defenderId: selectedTarget,
        heroIds: selectedHeroes,
      });
      setBattleLog(res.battleLog);
      setSelectedHeroes([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAttacking(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-50">Attaquer un donjon</h1>

      {loadingTargets && <p className="text-zinc-400">Recherche de cibles...</p>}
      {!loadingTargets && targets.length === 0 && (
        <p className="text-zinc-400">Aucun donjon adverse configuré pour le moment.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {targets.map((target) => (
          <Card
            key={target.ownerId}
            className={`cursor-pointer transition ${
              selectedTarget === target.ownerId ? "border-amber-500" : ""
            }`}
          >
            <button className="w-full text-left" onClick={() => setSelectedTarget(target.ownerId)}>
              <p className="font-semibold text-zinc-50">{target.displayName}</p>
              <p className="text-sm text-zinc-400">
                {target.roomCount} salle(s) gardée(s){target.hasBoss ? " · Boss" : ""}
              </p>
              <p className="text-xs text-zinc-500">Valeur : {target.pointsSpent} pts</p>
            </button>
          </Card>
        ))}
      </div>

      {selectedTarget && (
        <Card>
          <h2 className="mb-3 font-semibold text-zinc-50">Choisir votre équipe</h2>
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
            onClick={attack}
            disabled={attacking || selectedHeroes.length === 0}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {attacking ? "Attaque en cours..." : "Lancer l'attaque"}
          </button>
        </Card>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {battleLog && (
        <Card>
          <h2
            className={`mb-3 text-lg font-bold ${
              battleLog.outcome === "victoire" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {battleLog.outcome === "victoire" ? "Victoire !" : "Défaite..."}
          </h2>
          {battleLog.outcome === "victoire" && (
            <p className="mb-3 text-sm text-amber-400">
              Butin : {battleLog.rewards.gold} or
              {Object.entries(battleLog.rewards.resources)
                .map(([k, v]) => `, ${v} ${k}`)
                .join("")}
            </p>
          )}
          <ol className="max-h-80 space-y-1 overflow-y-auto text-sm text-zinc-400">
            {battleLog.rounds.map((round, i) => (
              <li key={i}>{round.message}</li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
