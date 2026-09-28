"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { getZone } from "@/lib/game/content/zones";
import { getDifficulty, zoneAtDifficulty } from "@/lib/game/content/difficulties";
import { equippedItemsOf, resolveHeroStats } from "@/lib/game/engine/stats";
import { RARITY_ICON, RARITY_LABEL, RARITY_TEXT } from "@/lib/ui/rarity";
import { focusRing } from "@/lib/ui/a11y";
import { Icon } from "@/components/Icon";
import { NavIcon } from "@/components/NavIcon";
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
        <span key={i} className={i <= count ? "text-gold" : "text-fg-faint"}>
          ★
        </span>
      ))}
    </span>
  );
}

/** The play route hides the mobile tab bar, so the page carries its own way out. */
function BackLink() {
  return (
    <Link
      href="/expeditions"
      transitionTypes={["nav-back"]}
      className={`group -ml-2 inline-flex h-10 items-center gap-1 rounded-lg px-2 text-sm text-fg-muted transition-colors duration-150 hover:text-fg ${focusRing}`}
    >
      <NavIcon
        name="chevron-right"
        className="h-4 w-4 rotate-180 transition-transform duration-150 ease-out group-hover:-translate-x-0.5"
      />
      Expéditions
    </Link>
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
  const [lastResult, setLastResult] = useState<ArenaRunResult | null>(null);
  const [abandoning, setAbandoning] = useState(false);

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
        <BackLink />
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
    setLastResult(result);
    setPhase("submitting");
    setError(null);
    try {
      setOutcome(await callApi<ExpeditionClaimResponse>("/api/expeditions/claim", { expeditionId, result }));
    } catch (e) {
      setError((e as Error).message);
    }
    setPhase("result");
  }

  // A failed claim leaves the expedition active and its heroes locked: offer to resend or give up.
  async function abandon() {
    setAbandoning(true);
    setError(null);
    try {
      await callApi("/api/expeditions/abandon", { expeditionId });
      router.replace("/expeditions");
    } catch (e) {
      setError((e as Error).message);
      setAbandoning(false);
    }
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
        <div className="space-y-3">
          <BackLink />
          <PageHeader
            title={difficulty.id === "normal" ? zone.name : `${zone.name} ${difficulty.icon} ${difficulty.name}`}
            subtitle={`Boss : ${zone.boss.name} · ${zone.durationSec}s max`}
          />
        </div>

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
          <Card accent={outcome?.survived ? "success" : "gold"} className="animate-pop">
            {outcome && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2
                    className={`font-display text-xl font-semibold sm:text-2xl ${outcome.survived ? "text-emerald-300" : "text-gold"}`}
                  >
                    {outcome.bossKilled
                      ? `${zone.boss.name} est vaincu !`
                      : outcome.survived
                        ? "Expédition réussie !"
                        : "L'équipe a dû se replier..."}
                  </h2>
                  <Stars count={outcome.stars} />
                </div>
                {(outcome.newBestStars && outcome.stars > 0) ||
                outcome.unlockedZoneName ||
                outcome.unlockedDifficultyName ||
                outcome.dailyBonus ? (
                  <ul className="space-y-1.5 text-sm">
                    {outcome.newBestStars && outcome.stars > 0 && (
                      <li className="rounded-lg border border-gold/25 bg-gold/[0.06] px-3 py-2 text-gold">
                        Nouveau record sur cette zone !
                      </li>
                    )}
                    {outcome.unlockedZoneName && (
                      <li className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-emerald-300">
                        Nouvelle zone débloquée : <span className="font-semibold">{outcome.unlockedZoneName}</span>
                      </li>
                    )}
                    {outcome.unlockedDifficultyName && (
                      <li className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-emerald-300">
                        Difficulté débloquée sur cette zone : <span className="font-semibold">{outcome.unlockedDifficultyName}</span>
                      </li>
                    )}
                    {outcome.dailyBonus && (
                      <li className="rounded-lg border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-sky-300">
                        Première victoire du jour dans cette zone : bonus de cristaux et jeton de rang !
                      </li>
                    )}
                  </ul>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-line bg-white/[0.025] p-3 text-sm">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">Butin</p>
                    <ul className="space-y-1.5 tabular-nums text-fg">
                      <li className="flex items-center gap-2">
                        <Icon name="gold" className="h-4 w-4" />
                        <span className="text-amber-300">{outcome.loot.gold}</span> or
                      </li>
                      {Object.entries(outcome.loot.resources).map(([kind, amount]) => (
                        <li key={kind} className="flex items-center gap-2">
                          <Icon name={kind as ResourceKind} className="h-4 w-4" />
                          {amount} {RESOURCE_LABEL[kind as ResourceKind]}
                        </li>
                      ))}
                      {[outcome.loot.item, outcome.loot.extraItem].map(
                        (dropped, i) =>
                          dropped && (
                            <li key={i} className="flex items-center gap-2">
                              <Icon name={RARITY_ICON[dropped.rarity]} className="h-4 w-4" />
                              <span className={`font-medium ${RARITY_TEXT[dropped.rarity]}`}>{dropped.name}</span>
                              <span className="text-xs text-fg-subtle">({RARITY_LABEL[dropped.rarity]})</span>
                            </li>
                          ),
                      )}
                      {outcome.loot.monsterCaptured && <li className="text-purple-300">🕸️ Monstre capturé !</li>}
                      {outcome.crystalsEarned > 0 && (
                        <li className="flex items-center gap-2">
                          <Icon name="crystal" className="h-4 w-4" />
                          {outcome.crystalsEarned} cristaux
                        </li>
                      )}
                      {outcome.rankTokensEarned > 0 && (
                        <li className="flex items-center gap-2">
                          <Icon name="rank-token" className="h-4 w-4" />
                          {outcome.rankTokensEarned} jeton(s) de rang
                        </li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-line bg-white/[0.025] p-3 text-sm">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">Équipe</p>
                    <div className="space-y-1.5 tabular-nums text-fg">
                      <p>☠️ {outcome.killCount} monstres vaincus</p>
                      <p>
                        <span className="text-sky-300">+{outcome.xpGained} XP</span> par héros
                      </p>
                      {outcome.levelUps.map((l) => (
                        <p key={l.heroId} className="text-emerald-300">
                          {l.name} : Nv. {l.from} → <span className="font-semibold">{l.to}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
                {outcome.stars < 3 && (
                  <p className="text-xs text-fg-subtle">
                    <span className="text-gold">★</span> survivre · <span className="text-gold">★★</span> vaincre le boss ·{" "}
                    <span className="text-gold">★★★</span> vaincre le boss sans aucun héros KO
                  </p>
                )}
              </div>
            )}
            {error && <p className="text-sm text-red-300">{error}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
              {outcome ? (
                <Button onClick={replay} disabled={replaying}>
                  {replaying ? "Départ..." : "Rejouer"}
                </Button>
              ) : (
                <>
                  {lastResult && (
                    <Button onClick={() => handleFinish(lastResult)} disabled={abandoning}>
                      Réessayer l&apos;envoi
                    </Button>
                  )}
                  <Button variant="danger" onClick={abandon} disabled={abandoning}>
                    {abandoning ? "Abandon..." : "Abandonner (sans butin)"}
                  </Button>
                </>
              )}
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
