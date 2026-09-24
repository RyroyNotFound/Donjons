"use client";

import { useState } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import {
  FIRST_CLASS_GUARANTEE_PULL,
  PITY_EPIQUE_THRESHOLD,
  PITY_LEGENDAIRE_THRESHOLD,
  PITY_RARE_THRESHOLD,
} from "@/lib/game/content/gacha";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { GachaResultCard } from "@/components/gacha/GachaResultCard";
import { Observatory } from "@/components/gacha/Observatory";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { PageTransition } from "@/components/PageTransition";
import type { GachaPullResult } from "@/types/game";

const SUMMON_ANIMATION_MS = 1100;

type Phase = "idle" | "summoning" | "reveal";

export default function GachaPage() {
  const { profile } = useGameData();
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<GachaPullResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const crystals = profile?.crystals ?? 0;
  const pity = profile?.gachaPity;
  const pulling = phase === "summoning";

  async function pull(count: 1 | 10) {
    setError(null);
    setResults(null);
    setPhase("summoning");
    try {
      const [res] = await Promise.all([
        callApi<{ results: GachaPullResult[] }>("/api/gacha/pull", { count }),
        new Promise((resolve) => setTimeout(resolve, SUMMON_ANIMATION_MS)),
      ]);
      setResults(res.results);
      setPhase("reveal");
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  }

  return (
    <PageTransition>
    <div className="space-y-6">
      <PageHeader
        title="Invocation"
        subtitle="Dépensez vos cristaux pour débloquer classes, sorts, talents et maîtrises."
        action={
          <div className="flex flex-wrap gap-2">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-lg font-semibold text-sky-300">
              💎 {crystals}
            </p>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-lg font-semibold text-violet-300">
              ✦ {profile?.stardust ?? 0}
            </p>
          </div>
        }
      />

      {pity && (
        <Card accent="epique">
          <h2 className="font-display mb-3 text-sm font-semibold tracking-wide text-slate-300">
            Progression avant garantie
          </h2>
          <div className="space-y-3 text-xs text-slate-400">
            {profile && profile.unlockedClasses.length === 0 && (
              <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-amber-200">
                🎓 Première classe garantie :{" "}
                {Math.max(1, FIRST_CLASS_GUARANTEE_PULL - pity.totalPulls) === 1
                  ? "au prochain tirage !"
                  : `dans ${FIRST_CLASS_GUARANTEE_PULL - pity.totalPulls} tirages au plus.`}
              </p>
            )}
            <div>
              <div className="mb-1 flex justify-between">
                <span>Rare+</span>
                <span>
                  {pity.pullsSinceRare}/{PITY_RARE_THRESHOLD}
                </span>
              </div>
              <ProgressBar
                value={pity.pullsSinceRare}
                max={PITY_RARE_THRESHOLD}
                colorClassName="from-sky-400 to-sky-600"
              />
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span>Épique+</span>
                <span>
                  {pity.pullsSinceEpique}/{PITY_EPIQUE_THRESHOLD}
                </span>
              </div>
              <ProgressBar
                value={pity.pullsSinceEpique}
                max={PITY_EPIQUE_THRESHOLD}
                colorClassName="from-purple-400 to-purple-600"
              />
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span>Légendaire</span>
                <span>
                  {pity.pullsSinceLegendaire}/{PITY_LEGENDAIRE_THRESHOLD}
                </span>
              </div>
              <ProgressBar
                value={pity.pullsSinceLegendaire}
                max={PITY_LEGENDAIRE_THRESHOLD}
                colorClassName="from-amber-300 to-amber-500"
              />
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-3">
        <Button onClick={() => pull(1)} disabled={pulling || crystals < 1}>
          Tirage x1 (1 💎)
        </Button>
        <Button onClick={() => pull(10)} disabled={pulling || crystals < 10}>
          Tirage x10 (10 💎)
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {phase === "summoning" && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <div className="gacha-portal flex h-24 w-24 items-center justify-center rounded-full border-4 border-amber-500/70 border-t-transparent text-4xl shadow-[0_0_30px_rgba(245,158,11,0.35)]">
            💎
          </div>
          <p className="animate-pulse text-sm text-amber-300">Invocation en cours...</p>
        </div>
      )}

      {phase === "reveal" && results && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {results.map((result, i) => (
            <GachaResultCard key={i} result={result} index={i} />
          ))}
        </div>
      )}

      {profile && <Observatory profile={profile} />}

      <Card>
        <h2 className="font-display mb-2 text-sm font-semibold tracking-wide text-slate-300">💎 Obtenir des cristaux</h2>
        <ul className="list-inside list-disc space-y-1 text-xs text-slate-400">
          <li>Chaque expédition réussie : 1 à 3 cristaux selon la zone, +1 en Cauchemar et Tourment.</li>
          <li>Première victoire du jour dans chaque zone : +2 cristaux et 1 jeton de rang.</li>
          <li>Premier succès et premier 3★ de chaque zone, dans chaque difficulté : jusqu&apos;à +11 cristaux d&apos;un coup.</li>
          <li>Raids : conquérir un donjon de joueur (+3), un donjon d&apos;entraînement (+3 à +12 la première fois, +1 ensuite).</li>
          <li>Défendre votre donjon avec succès : +2. Et la taverne vend parfois des cristaux…</li>
        </ul>
      </Card>
    </div>
    </PageTransition>
  );
}
