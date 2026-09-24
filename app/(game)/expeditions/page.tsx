"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { ZONES } from "@/lib/game/content/zones";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button, buttonClasses } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { PageTransition } from "@/components/PageTransition";

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
      router.push(`/expeditions/jouer/${res.expeditionId}`, { transitionTypes: ["nav-forward"] });
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
    <PageTransition>
    <div className="space-y-6">
      <PageHeader title="Expéditions de farm" subtitle="Envoyez votre équipe récolter loot et ressources." />

      {activeExpeditions.length > 0 && (
        <Card accent="gold">
          <h2 className="font-display mb-3 font-semibold text-slate-50">En cours</h2>
          <ul className="space-y-2">
            {activeExpeditions.map((exp) => {
              const expZone = ZONES.find((z) => z.id === exp.zoneId)!;
              return (
                <li
                  key={exp.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">
                    {expZone.name} — {exp.heroIds.length} héros
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/expeditions/jouer/${exp.id}`}
                      transitionTypes={["nav-forward"]}
                      className={buttonClasses("primary", "sm")}
                    >
                      Reprendre
                    </Link>
                    <button
                      onClick={() => abandon(exp.id)}
                      disabled={abandoningId === exp.id}
                      className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-400 hover:bg-white/5 disabled:opacity-40"
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
          <Card key={z.id} accent={selectedZone === z.id ? "gold" : "default"} interactive>
            <button
              className="w-full text-left"
              onClick={() => {
                setSelectedZone(z.id);
                setSelectedHeroes([]);
              }}
            >
              <p className="font-display font-semibold text-slate-50">{z.name}</p>
              <p className="text-sm text-slate-400">{z.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                {z.durationSec}s · {z.heroSlots} héros max · difficulté {z.difficulty}
              </p>
            </button>
          </Card>
        ))}
      </div>

      {zone && (
        <Card>
          <h2 className="font-display mb-3 font-semibold text-slate-50">
            Équipe pour {zone.name} ({selectedHeroes.length}/{zone.heroSlots})
          </h2>
          <div className="flex flex-wrap gap-2">
            {idleHeroes.map((hero) => (
              <Chip key={hero.id} selected={selectedHeroes.includes(hero.id)} onClick={() => toggleHero(hero.id)}>
                {hero.name} (Nv.{hero.level})
              </Chip>
            ))}
          </div>
          {idleHeroes.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">Aucun héros disponible.</p>
          )}
          <Button onClick={start} disabled={starting || selectedHeroes.length === 0} className="mt-4">
            {starting ? "Départ..." : "Entrer dans l'arène"}
          </Button>
        </Card>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
    </PageTransition>
  );
}
