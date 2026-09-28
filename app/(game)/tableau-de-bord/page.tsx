"use client";

import Link from "next/link";
import { useGameData } from "@/lib/game/GameDataProvider";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { ProgressBar } from "@/components/ProgressBar";
import { NavIcon, type NavIconName } from "@/components/NavIcon";
import { buttonClasses } from "@/components/Button";
import { focusRing } from "@/lib/ui/a11y";
import { getZone } from "@/lib/game/content/zones";
import { maxRoomsForLevel } from "@/lib/game/content/dungeonUpgrades";

interface FirstStep {
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

function StepMark({ state }: { state: "done" | "next" | "todo" }) {
  if (state === "done") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
          <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
        state === "next" ? "border-gold/60 bg-gold/10" : "border-line-strong"
      }`}
    >
      {state === "next" && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
    </span>
  );
}

function StatTile({
  href,
  icon,
  label,
  value,
  cta,
  delay,
}: {
  href: string;
  icon: NavIconName;
  label: string;
  value: React.ReactNode;
  cta: string;
  delay: number;
}) {
  return (
    <Link
      href={href}
      transitionTypes={["nav-forward"]}
      className={`animate-rise group block rounded-xl border border-line bg-surface p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] transition-[transform,border-color,background-color] duration-150 ease-out hover:border-line-strong hover:bg-surface-2 active:scale-[0.99] ${focusRing}`}
      style={{ "--delay": `${delay}ms` } as React.CSSProperties}
    >
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <NavIcon name={icon} className="h-4 w-4 text-fg-subtle" />
          {label}
        </p>
        <NavIcon
          name="chevron-right"
          className="h-4 w-4 text-fg-faint transition-[transform,color] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-gold"
        />
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-fg">{value}</p>
      <p className="mt-1 text-xs text-fg-subtle">{cta}</p>
    </Link>
  );
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
      <div className="space-y-8">
        <PageHeader
          title={`Bienvenue, ${profile?.displayName ?? "aventurier"}`}
          subtitle="Voici l'état de votre camp aujourd'hui."
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            href="/heros"
            icon="heroes"
            label="Héros disponibles"
            value={
              <>
                {idleHeroes.length}
                <span className="text-fg-faint">/{heroes.length}</span>
              </>
            }
            cta="Voir la garnison"
            delay={0}
          />
          <StatTile
            href="/donjon"
            icon="dungeon"
            label="Salles configurées"
            value={
              <>
                {configuredRooms}
                <span className="text-fg-faint">/{maxRooms}</span>
              </>
            }
            cta="Configurer le donjon"
            delay={50}
          />
          <StatTile
            href="/expeditions"
            icon="map"
            label="Expéditions en cours"
            value={activeExpeditions.length}
            cta="Lancer une expédition"
            delay={100}
          />
        </div>

        {profile && (
          <Card accent={nextStep ? "gold" : "default"} className="p-0">
            {/* Open while steps remain; once all are done it collapses to one line but stays re-openable. */}
            <details open={Boolean(nextStep)} className="group">
              <summary className={`flex cursor-pointer list-none items-center gap-4 rounded-xl p-5 ${focusRing}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-semibold text-fg">
                      Premiers pas
                      {!nextStep && <span className="ml-2 text-sm font-normal text-emerald-300">Terminé</span>}
                    </h2>
                    <span className="text-xs tabular-nums text-fg-subtle">
                      {stepsDone}/{firstSteps.length}
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <ProgressBar
                      value={stepsDone}
                      max={firstSteps.length}
                      size="sm"
                      label="Progression des premiers pas"
                      colorClassName={nextStep ? undefined : "from-emerald-500 to-emerald-300"}
                    />
                  </div>
                </div>
                <svg
                  viewBox="0 0 16 16"
                  className="h-4 w-4 shrink-0 text-fg-subtle transition-transform duration-200 ease-out group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  aria-hidden
                >
                  <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <ol className="space-y-1 px-3 pb-3">
                {firstSteps.map((step) => {
                  const state = step.done ? "done" : step === nextStep ? "next" : "todo";
                  if (state === "next") {
                    return (
                      <li
                        key={step.label}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-gold/20 bg-gold/[0.05] px-3 py-3"
                      >
                        <StepMark state="next" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-fg">{step.label}</p>
                          <p className="mt-0.5 text-xs text-fg-muted">{step.hint}</p>
                        </div>
                        <Link href={step.href} transitionTypes={["nav-forward"]} className={buttonClasses("primary", "sm")}>
                          C&apos;est parti
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={step.label} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <StepMark state={state} />
                      <span className={state === "done" ? "text-fg-faint line-through" : "text-fg-muted"}>
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </details>
          </Card>
        )}

        {activeExpeditions.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-fg">
                Expéditions en cours <span className="text-fg-subtle">· {activeExpeditions.length}</span>
              </h2>
              <Link
                href="/expeditions"
                transitionTypes={["nav-forward"]}
                className="text-sm text-gold transition-colors duration-150 hover:text-gold-bright"
              >
                Gérer
              </Link>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {activeExpeditions.map((exp) => {
                const zone = getZone(exp.zoneId);
                return (
                  <li key={exp.id}>
                    <Link
                      href={`/expeditions/jouer/${exp.id}`}
                      transitionTypes={["nav-forward"]}
                      className={`group flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors duration-150 hover:bg-white/[0.03] ${focusRing}`}
                    >
                      <span className="text-fg">{zone.name}</span>
                      <span className="flex items-center gap-1 text-gold">
                        Reprendre
                        <NavIcon
                          name="chevron-right"
                          className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </PageTransition>
  );
}
