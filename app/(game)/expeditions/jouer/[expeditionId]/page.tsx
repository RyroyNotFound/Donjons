"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { getZone } from "@/lib/game/content/zones";
import { resolveHeroStats, compositePartyStats } from "@/lib/game/engine/stats";
import { computePartyAbilities } from "@/lib/game/arena/engine";
import { ArenaGame } from "@/components/expedition/ArenaGame";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { PageTransition } from "@/components/PageTransition";
import type { ArenaRunResult, Item } from "@/types/game";
import type { ExpeditionLootResult } from "@/lib/game/engine/loot";

export default function JouerExpeditionPage() {
  const { expeditionId } = useParams<{ expeditionId: string }>();
  const { heroes, items, expeditions, profile } = useGameData();
  const [phase, setPhase] = useState<"playing" | "submitting" | "result">("playing");
  const [outcome, setOutcome] = useState<{
    loot: ExpeditionLootResult;
    survived: boolean;
    crystalsEarned: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const expedition = expeditions.find((e) => e.id === expeditionId);

  if (!expedition) {
    return (
      <PageTransition>
        <Spinner label="Chargement de l'expédition..." />
      </PageTransition>
    );
  }

  if (expedition.status === "claimed" && phase !== "result") {
    return (
      <PageTransition>
        <EmptyState
          message="Cette expédition a déjà été réclamée."
          backHref="/expeditions"
          backLabel="Retour aux expéditions"
        />
      </PageTransition>
    );
  }

  const zone = getZone(expedition.zoneId);
  const partyHeroes = heroes.filter((h) => expedition.heroIds.includes(h.id));
  const statsList = partyHeroes.map((hero) => {
    const equippedItems = Object.values(hero.equipment)
      .filter(Boolean)
      .map((id) => items.find((i) => i.id === id))
      .filter(Boolean) as Item[];
    return resolveHeroStats(hero, equippedItems, profile?.componentRanks);
  });
  const partyStats = compositePartyStats(statsList);
  const abilities = computePartyAbilities(
    partyHeroes.map((h) => ({ equippedSpellIds: h.equippedSpellIds, classId: h.classId })),
  );

  async function handleFinish(result: ArenaRunResult) {
    setPhase("submitting");
    setError(null);
    try {
      const res = await callApi<{
        loot: ExpeditionLootResult;
        survived: boolean;
        crystalsEarned: number;
      }>("/api/expeditions/claim", { expeditionId, result });
      setOutcome(res);
      setPhase("result");
    } catch (e) {
      setError((e as Error).message);
      setPhase("result");
    }
  }

  return (
    <PageTransition>
    <div className="space-y-6">
      <PageHeader
        title={zone.name}
        subtitle={`Équipe : ${partyHeroes.map((h) => h.name).join(", ")}`}
      />

      {phase === "playing" && (
        <ArenaGame
          zone={zone}
          partyStats={partyStats}
          abilities={abilities}
          leaderClassId={partyHeroes[0]?.classId}
          seed={expeditionId}
          onFinish={handleFinish}
        />
      )}

      {phase === "submitting" && <Spinner label="Calcul du butin..." />}

      {phase === "result" && (
        <Card accent={outcome?.survived ? "success" : "gold"}>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {outcome && (
            <>
              <h2
                className={`font-display mb-2 text-lg font-bold ${
                  outcome.survived ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {outcome.survived ? "Expédition réussie !" : "L'équipe a dû se replier..."}
              </h2>
              <p className="text-sm text-slate-300">
                Butin : {outcome.loot.gold} or
                {Object.entries(outcome.loot.resources)
                  .map(([k, v]) => `, ${v} ${k}`)
                  .join("")}
                {outcome.loot.item &&
                  `, objet trouvé : ${outcome.loot.item.name} (${outcome.loot.item.rarity})`}
                {outcome.loot.monsterCaptured && `, monstre capturé !`}
                {outcome.crystalsEarned > 0 && `, ${outcome.crystalsEarned} 💎`}
              </p>
            </>
          )}
          <Link
            href="/expeditions"
            transitionTypes={["nav-back"]}
            className="mt-4 inline-block text-amber-400 hover:underline"
          >
            ← Retour aux expéditions
          </Link>
        </Card>
      )}
    </div>
    </PageTransition>
  );
}
