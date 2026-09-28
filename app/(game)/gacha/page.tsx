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
import { Panel } from "@/components/Panel";
import { ProgressBar } from "@/components/ProgressBar";
import { GachaResultCard } from "@/components/gacha/GachaResultCard";
import { Observatory } from "@/components/gacha/Observatory";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/PageTransition";
import type { GachaPullResult } from "@/types/game";

const SUMMON_ANIMATION_MS = 1100;

type Phase = "idle" | "summoning" | "reveal";

function PityCounter({
  label,
  value,
  max,
  colorClassName,
}: {
  label: string;
  value: number;
  max: number;
  colorClassName: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-fg-muted">{label}</span>
        <span className="tabular-nums text-fg-subtle">
          {value}/{max}
        </span>
      </div>
      <ProgressBar value={value} max={max} size="sm" colorClassName={colorClassName} label={`Garantie ${label}`} />
    </div>
  );
}

function CrystalCost({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums opacity-80">
      ({amount}
      <Icon name="crystal" label="cristaux" className="h-4 w-4" />)
    </span>
  );
}

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
      <div className="space-y-8">
        <PageHeader
          title="Invocation"
          subtitle="Dépensez vos cristaux pour débloquer classes, sorts, talents et maîtrises."
          action={
            <div className="flex flex-wrap gap-2">
              <p
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-semibold tabular-nums text-fg"
                title="Cristaux"
              >
                <Icon name="crystal" label="Cristaux" className="h-4 w-4" />
                {crystals}
              </p>
              <p
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-semibold tabular-nums text-fg"
                title="Poussière d'étoile"
              >
                <span className="text-purple-300" aria-hidden>
                  ✦
                </span>
                <span className="sr-only">Poussière d&apos;étoile :</span>
                {profile?.stardust ?? 0}
              </p>
            </div>
          }
        />

        <Card accent="gold" className="space-y-5">
          {profile && pity && profile.unlockedClasses.length === 0 && (
            <Panel tone="highlight" padding="sm" className="text-sm text-fg">
              <span className="font-medium text-gold">Première classe garantie :</span>{" "}
              {Math.max(1, FIRST_CLASS_GUARANTEE_PULL - pity.totalPulls) === 1
                ? "au prochain tirage !"
                : `dans ${FIRST_CLASS_GUARANTEE_PULL - pity.totalPulls} tirages au plus.`}
            </Panel>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Button size="lg" className="w-full" onClick={() => pull(1)} disabled={pulling || crystals < 1}>
              Tirage x1 <CrystalCost amount={1} />
            </Button>
            <Button size="lg" className="w-full" onClick={() => pull(10)} disabled={pulling || crystals < 10}>
              Tirage x10 <CrystalCost amount={10} />
            </Button>
          </div>

          {pity && (
            <div className="border-t border-line pt-4">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">
                Progression avant garantie
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <PityCounter
                  label="Rare+"
                  value={pity.pullsSinceRare}
                  max={PITY_RARE_THRESHOLD}
                  colorClassName="from-sky-500 to-sky-300"
                />
                <PityCounter
                  label="Épique+"
                  value={pity.pullsSinceEpique}
                  max={PITY_EPIQUE_THRESHOLD}
                  colorClassName="from-purple-500 to-purple-300"
                />
                <PityCounter
                  label="Légendaire"
                  value={pity.pullsSinceLegendaire}
                  max={PITY_LEGENDAIRE_THRESHOLD}
                  colorClassName="from-amber-500 to-amber-300"
                />
              </div>
            </div>
          )}
        </Card>

        {error && <p className="text-sm text-red-300">{error}</p>}

        {phase === "summoning" && (
          <div role="status" className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <span
                aria-hidden
                className="gacha-portal absolute inset-0 rounded-full border-2 border-gold/15 border-t-gold"
              />
              <span aria-hidden className="absolute inset-3 rounded-full bg-gold/[0.06]" />
              <Icon name="crystal" className="relative h-8 w-8" />
            </div>
            <p className="text-sm text-fg-muted">Invocation en cours...</p>
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
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-fg">
            <Icon name="crystal" className="h-4 w-4" />
            Obtenir des cristaux
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-fg-muted marker:text-fg-faint">
            <li>Chaque expédition réussie : 1 à 3 cristaux selon la zone, +1 en Cauchemar et Tourment.</li>
            <li>Première victoire du jour dans chaque zone : +2 cristaux et 1 jeton de rang.</li>
            <li>
              Premier succès et premier 3★ de chaque zone, dans chaque difficulté : jusqu&apos;à +11 cristaux d&apos;un
              coup.
            </li>
            <li>
              Raids : conquérir un donjon de joueur (+3), un donjon d&apos;entraînement (+3 à +12 la première fois, +1
              ensuite).
            </li>
            <li>Défendre votre donjon avec succès : +2. Et la taverne vend parfois des cristaux…</li>
          </ul>
        </Card>
      </div>
    </PageTransition>
  );
}
