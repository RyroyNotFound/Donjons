"use client";

import Link from "next/link";
import { useGameData } from "@/lib/game/GameDataProvider";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { getZone } from "@/lib/game/content/zones";
import { maxRoomsForLevel } from "@/lib/game/content/dungeonUpgrades";

interface FirstStep {
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

export default function TableauDeBordPage() {
  const { profile, heroes, items, dungeon, dungeonUpgrades, expeditions } = useGameData();

  // Derived from existing data only — nothing extra is stored for this guide.
  const firstSteps: FirstStep[] = [
    {
      label: "Faire ta première invocation",
      hint: "Tes cristaux de départ suffisent pour obtenir ta première classe.",
      href: "/gacha",
      done: (profile?.gachaPity.totalPulls ?? 0) > 0,
    },
    {
      label: "Assigner une classe à ton héros",
      hint: "Sans classe, un héros est très faible.",
      href: "/heros",
      done: heroes.some((h) => h.classId),
    },
    {
      label: "Équiper un sort",
      hint: "En expédition, les sorts se lancent tout seuls.",
      href: "/heros",
      done: heroes.some((h) => (h.equippedSpellIds ?? []).length > 0),
    },
    {
      label: "Réussir une expédition",
      hint: "Une minute dans l'arène : survis, bats le boss, rapporte le butin.",
      href: "/expeditions",
      done: Object.values(profile?.expeditionRecords ?? {}).some((r) => r.bestStars >= 1),
    },
    {
      label: "Équiper un objet",
      hint: "Forge-le avec les ressources d'expédition, ou équipe un objet trouvé.",
      href: "/forge",
      done: items.some((i) => i.equippedByHeroId),
    },
    {
      label: "Préparer ton donjon",
      hint: "Place au moins 3 salles pour te défendre contre les raids des autres joueurs.",
      href: "/donjon",
      done: (dungeon?.roomCount ?? 0) >= 3,
    },
  ];
  const nextStep = firstSteps.find((step) => !step.done);
  const stepsDone = firstSteps.filter((step) => step.done).length;

  const activeExpeditions = expeditions.filter((e) => e.status === "active");
  const idleHeroes = heroes.filter((h) => h.status === "idle");
  const configuredRooms = dungeon?.roomCount ?? 0;
  const maxRooms = maxRoomsForLevel(dungeonUpgrades?.levels.expansion ?? 0);

  return (
    <PageTransition>
    <div className="space-y-6">
      <PageHeader
        title={`Bienvenue, ${profile?.displayName ?? "aventurier"}`}
        subtitle="Voici l'état de votre camp aujourd'hui."
      />

      {profile && (
        <Card accent={nextStep ? "gold" : "default"}>
          {/* Open while steps remain; once all are done it collapses to one line but stays re-openable. */}
          <details open={Boolean(nextStep)} className="group">
          <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2">
            <h2 className="font-display font-semibold text-slate-50">
              Premiers pas {!nextStep && <span className="text-sm font-normal text-emerald-400">— terminé ✅</span>}
            </h2>
            <span className="text-xs text-slate-500">
              {stepsDone}/{firstSteps.length} <span className="inline-block transition group-open:rotate-180">▾</span>
            </span>
          </summary>
          <ol className="mt-3 space-y-1.5 text-sm">
            {firstSteps.map((step) => {
              const isNext = step === nextStep;
              return (
                <li key={step.label} className={step.done ? "text-slate-500 line-through" : isNext ? "text-slate-100" : "text-slate-400"}>
                  {step.done ? "✅" : isNext ? "👉" : "⬜"}{" "}
                  {isNext ? (
                    <Link href={step.href} transitionTypes={["nav-forward"]} className="font-semibold text-amber-300 hover:underline">
                      {step.label}
                    </Link>
                  ) : (
                    step.label
                  )}
                  {isNext && <span className="block pl-6 text-xs text-slate-400">{step.hint}</span>}
                </li>
              );
            })}
          </ol>
          </details>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="animate-rise" style={{ "--delay": "0s" } as React.CSSProperties}>
          <Card interactive accent="gold" className="h-full">
            <p className="text-sm text-slate-400">Héros disponibles</p>
            <p className="font-display mt-1 text-3xl font-bold text-slate-50">
              {idleHeroes.length}/{heroes.length}
            </p>
            <Link
              href="/heros"
              transitionTypes={["nav-forward"]}
              className="mt-2 inline-block text-sm text-amber-400 hover:underline"
            >
              Voir la garnison →
            </Link>
          </Card>
        </div>
        <div className="animate-rise" style={{ "--delay": "0.08s" } as React.CSSProperties}>
          <Card interactive accent="rare" className="h-full">
            <p className="text-sm text-slate-400">Salles configurées</p>
            <p className="font-display mt-1 text-3xl font-bold text-slate-50">
              {configuredRooms}/{maxRooms}
            </p>
            <Link
              href="/donjon"
              transitionTypes={["nav-forward"]}
              className="mt-2 inline-block text-sm text-amber-400 hover:underline"
            >
              Configurer le donjon →
            </Link>
          </Card>
        </div>
      </div>

      {activeExpeditions.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display font-semibold text-slate-50">
              Expéditions en cours ({activeExpeditions.length})
            </h2>
            <Link href="/expeditions" transitionTypes={["nav-forward"]} className="text-sm text-amber-400 hover:underline">
              Gérer →
            </Link>
          </div>
          <ul className="space-y-2">
            {activeExpeditions.map((exp) => {
              const zone = getZone(exp.zoneId);
              return (
                <li
                  key={exp.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">{zone.name}</span>
                  <Link
                    href={`/expeditions/jouer/${exp.id}`}
                    transitionTypes={["nav-forward"]}
                    className="text-amber-400 hover:underline"
                  >
                    Reprendre →
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
    </PageTransition>
  );
}
