"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { Badge } from "@/components/Badge";
import { Chip } from "@/components/Chip";
import { PageTransition } from "@/components/PageTransition";
import type { RaidView } from "@/types/game";

interface DungeonTarget {
  defenderId: string;
  displayName: string;
  roomCount: number;
  treasureRoomCount: number;
  pointsSpent: number;
  isBot: boolean;
}

export default function AttaquerPage() {
  const { heroes } = useGameData();
  const router = useRouter();
  const [targets, setTargets] = useState<DungeonTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedHeroes, setSelectedHeroes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [starting, setStarting] = useState(false);
  const [checkingActive, setCheckingActive] = useState(true);

  const idleHeroes = heroes.filter((h) => h.classId && h.status === "idle");

  useEffect(() => {
    callApi<{ targets: DungeonTarget[] }>("/api/dungeon/targets", undefined, "GET")
      .then((res) => setTargets(res.targets))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingTargets(false));

    callApi<{ view: RaidView | null }>("/api/dungeon/raid/active", undefined, "GET")
      .then((res) => {
        if (res.view)
          router.replace(`/donjon/attaquer/raid/${res.view.raidId}`, {
            transitionTypes: ["nav-forward"],
          });
      })
      .catch(() => {})
      .finally(() => setCheckingActive(false));
  }, [router]);

  function toggleHero(heroId: string) {
    setSelectedHeroes((prev) =>
      prev.includes(heroId) ? prev.filter((id) => id !== heroId) : [...prev, heroId],
    );
  }

  async function startRaid() {
    if (!selectedTarget || selectedHeroes.length === 0) return;
    setError(null);
    setStarting(true);
    try {
      const res = await callApi<{ raidId: string }>("/api/dungeon/raid/start", {
        defenderId: selectedTarget,
        heroIds: selectedHeroes,
      });
      router.push(`/donjon/attaquer/raid/${res.raidId}`, { transitionTypes: ["nav-forward"] });
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  }

  if (checkingActive)
    return (
      <PageTransition>
        <Spinner label="Vérification d'un raid en cours..." />
      </PageTransition>
    );

  return (
    <PageTransition>
    <div className="space-y-6">
      <PageHeader
        title="Attaquer un donjon"
        subtitle="Pillez les donjons des autres aventuriers, ou entraînez-vous contre des repaires."
      />

      {loadingTargets && <Spinner label="Recherche de cibles..." />}
      {!loadingTargets && targets.length === 0 && (
        <p className="text-slate-400">Aucune cible disponible pour le moment.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {targets.map((target) => (
          <Card
            key={target.defenderId}
            accent={selectedTarget === target.defenderId ? "gold" : target.isBot ? "danger" : "default"}
            interactive
          >
            <button className="w-full text-left" onClick={() => setSelectedTarget(target.defenderId)}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-display font-semibold text-slate-50">{target.displayName}</p>
                {target.isBot && <Badge tone="danger">Repaire</Badge>}
              </div>
              <p className="text-sm text-slate-400">
                {target.roomCount} salle(s) · {target.treasureRoomCount} trésor(s)
              </p>
              <p className="text-xs text-slate-500">Valeur : {target.pointsSpent} pts</p>
            </button>
          </Card>
        ))}
      </div>

      {selectedTarget && (
        <Card textured accent="danger">
          <h2 className="font-display mb-3 font-semibold text-slate-50">Choisir votre équipe</h2>
          <div className="flex flex-wrap gap-2">
            {idleHeroes.map((hero) => (
              <Chip
                key={hero.id}
                selected={selectedHeroes.includes(hero.id)}
                onClick={() => toggleHero(hero.id)}
              >
                {hero.name} (Nv.{hero.level})
              </Chip>
            ))}
          </div>
          {idleHeroes.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">Aucun héros disponible.</p>
          )}
          <Button
            variant="danger"
            onClick={startRaid}
            disabled={starting || selectedHeroes.length === 0}
            className="mt-4"
          >
            {starting ? "Préparation..." : "Lancer l'attaque"}
          </Button>
        </Card>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
    </PageTransition>
  );
}
