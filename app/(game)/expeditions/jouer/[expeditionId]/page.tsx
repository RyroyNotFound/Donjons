"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { getZone } from "@/lib/game/content/zones";
import { getDifficulty, zoneAtDifficulty } from "@/lib/game/content/difficulties";
import { equippedItemsOf, resolveHeroStats } from "@/lib/game/engine/stats";
import { RARITY_LABEL } from "@/lib/ui/rarity";
import { ArenaGame } from "@/components/expedition/ArenaGame";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button, buttonClasses } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { PageTransition } from "@/components/PageTransition";
import type { ArenaHeroInput } from "@/lib/game/arena/engine";
import type { ExpeditionClaimResponse } from "@/lib/game/engine/loot";
import type { ArenaRunResult, ResourceKind } from "@/types/game";

const RESOURCE_LABEL: Record<ResourceKind, string> = { wood: "Bois", ore: "Minerai", essence: "Essence" };

function Stars({ count }: { count: number }) {
  return (
    <span className="text-2xl tracking-widest" aria-label={`${count} étoile(s) sur 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= count ? "text-amber-300" : "text-slate-700"}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function JouerExpeditionPage() {
  const { expeditionId } = useParams<{ expeditionId: string }>();
  // Keyed so "Rejouer" (same route, new id) starts from a fresh run state.
  return <ExpeditionRun key={expeditionId} expeditionId={expeditionId} />;
}

function ExpeditionRun({ expeditionId }: { expeditionId: string }) {
  const router = useRouter();
  const { heroes, items, expeditions, profile } = useGameData();
  const [phase, setPhase] = useState<"playing" | "submitting" | "result">("playing");
  const [outcome, setOutcome] = useState<ExpeditionClaimResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);

  const expedition = expeditions.find((e) => e.id === expeditionId);
  const heroesLoaded = heroes.length > 0;

  // Frozen once at load so hero stat updates from the claim (level-ups) don't reset the arena.
  const party = useMemo<ArenaHeroInput[] | null>(() => {
    if (!expedition || heroes.length === 0) return null;
    return expedition.heroIds
      .map((id) => heroes.find((h) => h.id === id))
      .filter((h): h is NonNullable<typeof h> => Boolean(h))
      .map((hero) => ({
        id: hero.id,
        name: hero.name,
        classId: hero.classId,
        stats: resolveHeroStats(hero, equippedItemsOf(hero, items), profile?.componentRanks),
        equippedSpellIds: hero.equippedSpellIds ?? [],
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expedition?.id, heroesLoaded]);

  if (!expedition || !party) {
    return (
      <PageTransition>
        <Spinner label="Chargement de l'expédition..." />
      </PageTransition>
    );
  }

  if (expedition.status === "claimed" && phase === "playing") {
    return (
      <PageTransition>
        <EmptyState message="Cette expédition a déjà été réclamée." backHref="/expeditions" backLabel="Retour aux expéditions" />
      </PageTransition>
    );
  }

  const difficulty = getDifficulty(expedition.difficulty);
  const zone = zoneAtDifficulty(getZone(expedition.zoneId), difficulty.id);

  async function handleFinish(result: ArenaRunResult) {
    setPhase("submitting");
    setError(null);
    try {
      setOutcome(await callApi<ExpeditionClaimResponse>("/api/expeditions/claim", { expeditionId, result }));
    } catch (e) {
      setError((e as Error).message);
    }
    setPhase("result");
  }

  async function replay() {
    setReplaying(true);
    setError(null);
    try {
      const res = await callApi<{ expeditionId: string }>("/api/expeditions/start", {
        zoneId: expedition!.zoneId,
        heroIds: expedition!.heroIds,
        difficulty: difficulty.id,
      });
      router.replace(`/expeditions/jouer/${res.expeditionId}`);
    } catch (e) {
      setError((e as Error).message);
      setReplaying(false);
    }
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title={difficulty.id === "normal" ? zone.name : `${zone.name} ${difficulty.icon} ${difficulty.name}`}
          subtitle={`Boss : ${zone.boss.name} · ${zone.durationSec}s max`}
        />

        {phase === "playing" && (
          <ArenaGame
            zone={zone}
            party={party}
            componentRanks={profile?.componentRanks}
            seed={expeditionId}
            onFinish={handleFinish}
          />
        )}

        {phase === "submitting" && <Spinner label="Calcul du butin..." />}

        {phase === "result" && (
          <Card accent={outcome?.survived ? "success" : "gold"}>
            {outcome && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className={`font-display text-xl font-bold ${outcome.survived ? "text-emerald-400" : "text-amber-400"}`}>
                    {outcome.bossKilled
                      ? `${zone.boss.name} est vaincu !`
                      : outcome.survived
                        ? "Expédition réussie !"
                        : "L'équipe a dû se replier..."}
                  </h2>
                  <Stars count={outcome.stars} />
                </div>
                {outcome.newBestStars && outcome.stars > 0 && (
                  <p className="text-sm text-amber-300">Nouveau record sur cette zone !</p>
                )}
                {outcome.unlockedZoneName && (
                  <p className="text-sm text-emerald-300">🔓 Nouvelle zone débloquée : {outcome.unlockedZoneName}</p>
                )}
                {outcome.unlockedDifficultyName && (
                  <p className="text-sm text-emerald-300">🔓 Difficulté débloquée sur cette zone : {outcome.unlockedDifficultyName}</p>
                )}
                {outcome.dailyBonus && (
                  <p className="text-sm text-sky-300">☀️ Première victoire du jour dans cette zone : bonus de cristaux et jeton de rang !</p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Butin</p>
                    <ul className="space-y-0.5">
                      <li>🪙 {outcome.loot.gold} or</li>
                      {Object.entries(outcome.loot.resources).map(([kind, amount]) => (
                        <li key={kind}>
                          📦 {amount} {RESOURCE_LABEL[kind as ResourceKind]}
                        </li>
                      ))}
                      {outcome.loot.item && (
                        <li>
                          🎁 {outcome.loot.item.name} ({RARITY_LABEL[outcome.loot.item.rarity]})
                        </li>
                      )}
                      {outcome.loot.monsterCaptured && <li>🕸️ Monstre capturé !</li>}
                      {outcome.crystalsEarned > 0 && <li>💎 {outcome.crystalsEarned} cristaux</li>}
                      {outcome.rankTokensEarned > 0 && <li>🎖️ {outcome.rankTokensEarned} jeton(s) de rang</li>}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Équipe</p>
                    <p>☠️ {outcome.killCount} monstres vaincus</p>
                    <p>✨ +{outcome.xpGained} XP par héros</p>
                    {outcome.levelUps.map((l) => (
                      <p key={l.heroId} className="text-emerald-300">
                        ⬆️ {l.name} : Nv. {l.from} → {l.to}
                      </p>
                    ))}
                  </div>
                </div>
                {outcome.stars < 3 && (
                  <p className="text-xs text-slate-500">
                    ★ survivre · ★★ vaincre le boss · ★★★ vaincre le boss sans aucun héros KO
                  </p>
                )}
              </div>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={replay} disabled={replaying}>
                {replaying ? "Départ..." : "Rejouer"}
              </Button>
              <Link href="/expeditions" transitionTypes={["nav-back"]} className={buttonClasses("secondary")}>
                Changer d&apos;équipe ou de zone
              </Link>
            </div>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
