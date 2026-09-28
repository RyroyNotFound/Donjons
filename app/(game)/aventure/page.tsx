"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import {
  ADVENTURE_PREFIX,
  ADVENTURE_STAGES,
  ADVENTURE_WORLDS,
  isStageUnlocked,
  type AdventureStage,
} from "@/lib/game/content/adventure";
import { RAID_PARTY_MAX } from "@/lib/game/content/dungeon";
import { dungeonDefenseLevel } from "@/lib/game/content/dungeonUpgrades";
import { dungeonIntel } from "@/lib/game/dungeonIntel";
import { equippedItemsOf, heroPower, resolveHeroStats } from "@/lib/game/engine/stats";
import { ELEMENT_ICON, ELEMENT_LABEL } from "@/lib/game/engine/elements";
import { tryGetClass } from "@/lib/game/content/classes";
import { RARITY_LABEL } from "@/lib/ui/rarity";
import { focusRing } from "@/lib/ui/a11y";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Badge } from "@/components/Badge";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/PageTransition";
import type { RaidView } from "@/types/game";

function StageGlyph({ cleared, unlocked, isBoss }: { cleared: boolean; unlocked: boolean; isBoss: boolean }) {
  if (cleared) {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-emerald-300" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
        <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (!unlocked) {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-fg-faint" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
        <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" strokeLinecap="round" />
      </svg>
    );
  }
  if (isBoss) return <span className="text-base leading-4">💀</span>;
  return <Icon name="sword" className="h-4 w-4" />;
}

function StageNode({
  stage,
  cleared,
  unlocked,
  selected,
  onSelect,
}: {
  stage: AdventureStage;
  cleared: boolean;
  unlocked: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={onSelect}
      title={unlocked ? stage.name : "Terminez le donjon précédent"}
      className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg border px-1 text-center transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed ${focusRing} ${
        selected
          ? "border-gold/45 bg-gold/10"
          : cleared
            ? "border-emerald-400/25 bg-emerald-400/[0.06] hover:bg-emerald-400/10"
            : unlocked
              ? "border-gold/30 bg-white/[0.025] hover:border-gold/45 hover:bg-white/[0.04]"
              : "border-line bg-black/20 opacity-40"
      }`}
    >
      <StageGlyph cleared={cleared} unlocked={unlocked} isBoss={!!stage.isBoss} />
      <span className={`text-[11px] tabular-nums ${selected ? "text-gold" : "text-fg-subtle"}`}>niv {stage.defenseLevel}</span>
    </button>
  );
}

export default function AventurePage() {
  const { heroes, items, profile } = useGameData();
  const router = useRouter();
  const cleared = profile?.adventureCleared ?? {};
  const nextStage = ADVENTURE_STAGES.find((s) => !cleared[s.id]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedHeroes, setSelectedHeroes] = useState<string[]>([]);
  const [activeRaid, setActiveRaid] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callApi<{ view: RaidView | null }>("/api/dungeon/raid/active", undefined, "GET")
      .then((res) => setActiveRaid(res.view?.raidId ?? null))
      .catch(() => {});
  }, []);

  const stage = ADVENTURE_STAGES.find((s) => s.id === selectedId) ?? nextStage ?? ADVENTURE_STAGES[ADVENTURE_STAGES.length - 1];
  const world = ADVENTURE_WORLDS[stage.worldIndex];
  const intel = dungeonIntel({ rooms: stage.rooms, garrisonHeroIds: [], defenseLevel: stage.defenseLevel });
  const stageCleared = !!cleared[stage.id];
  const idleHeroes = heroes.filter((h) => h.classId && h.status === "idle");
  const team = idleHeroes.filter((h) => selectedHeroes.includes(h.id));
  const teamLevel = dungeonDefenseLevel(team.map((h) => h.level));
  const gap = teamLevel - stage.defenseLevel;
  const clearedCount = ADVENTURE_STAGES.filter((s) => cleared[s.id]).length;

  function toggleHero(id: string) {
    setSelectedHeroes((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : prev.length >= RAID_PARTY_MAX ? prev : [...prev, id],
    );
  }

  async function start() {
    const heroIds = team.map((h) => h.id);
    if (heroIds.length === 0) return;
    setError(null);
    setStarting(true);
    try {
      const res = await callApi<{ raidId: string }>("/api/dungeon/raid/start", { defenderId: `${ADVENTURE_PREFIX}${stage.id}`, heroIds });
      router.push(`/donjon/attaquer/raid/${res.raidId}`, { transitionTypes: ["nav-forward"] });
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  }

  return (
    <PageTransition>
      <div className="space-y-8">
        <PageHeader
          title="Mode aventure"
          subtitle={`Traversez 5 mondes, donjon après donjon. Chaque premier succès rapporte une récompense unique. Progression : ${clearedCount}/${ADVENTURE_STAGES.length}`}
        />

        {activeRaid && (
          <Card accent="gold" className="px-4 py-3">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" aria-hidden />
                Un raid est en cours.
              </span>
              <Link
                href={`/donjon/attaquer/raid/${activeRaid}`}
                className="font-medium text-gold transition-colors duration-150 hover:text-gold-bright"
              >
                Le reprendre
              </Link>
            </p>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            {ADVENTURE_WORLDS.map((w, wi) => {
              const stages = ADVENTURE_STAGES.filter((s) => s.worldIndex === wi);
              const open = isStageUnlocked(stages[0], cleared);
              const done = stages.every((s) => cleared[s.id]);
              return (
                <Card key={w.id} accent={done ? "success" : open ? "default" : undefined} className="p-4">
                  <div className={open ? "" : "opacity-50"}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <p className="font-semibold text-fg">
                        <span className="tabular-nums text-fg-subtle">{wi + 1}.</span> {w.name}
                      </p>
                      <span className="shrink-0 text-xs tabular-nums text-fg-subtle">
                        niv {stages[0].defenseLevel}–{stages[stages.length - 1].defenseLevel}
                      </span>
                    </div>
                    <p className="mb-3 text-xs leading-relaxed text-fg-muted">{w.description}</p>
                    <div className="flex gap-1.5">
                      {stages.map((s) => (
                        <StageNode
                          key={s.id}
                          stage={s}
                          cleared={!!cleared[s.id]}
                          unlocked={isStageUnlocked(s, cleared)}
                          selected={s.id === stage.id}
                          onSelect={() => setSelectedId(s.id)}
                        />
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="space-y-4">
            <Card accent={stage.isBoss ? "danger" : "gold"}>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">
                Monde {stage.worldIndex + 1} · donjon {stage.stageIndex + 1}
                {stage.isBoss && <span className="text-red-300"> · boss</span>}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-fg">{stage.name}</h2>
              <p className="mt-1 text-sm tabular-nums text-fg-muted">
                Niveau <span className="font-semibold text-gold">{stage.defenseLevel}</span> · {intel.roomCount} salles · {intel.monsters}{" "}
                monstre{intel.monsters > 1 ? "s" : ""} · {intel.traps} piège{intel.traps > 1 ? "s" : ""}
                {intel.hasBoss && " · 💀 Liche"}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                {intel.monsterElements.length + intel.trapElements.length > 0 && (
                  <span>
                    Dégâts :{" "}
                    {[...new Set([...intel.monsterElements, ...intel.trapElements])].map((e) => (
                      <span key={e} title={ELEMENT_LABEL[e]}>
                        {ELEMENT_ICON[e]}
                      </span>
                    ))}
                  </span>
                )}
                {intel.monsterWeaknesses.length > 0 && (
                  <span>
                    Faiblesses :{" "}
                    {intel.monsterWeaknesses.map((e) => (
                      <span key={e} title={ELEMENT_LABEL[e]}>
                        {ELEMENT_ICON[e]}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <p className="mt-3 border-l-2 border-gold/30 pl-3 text-xs leading-relaxed text-fg-subtle">{world.hint}</p>

              <div className="mt-4 rounded-lg border border-line bg-white/[0.025] p-3 text-sm">
                <p className={`mb-1 text-xs font-medium ${stageCleared ? "text-emerald-300" : "text-gold"}`}>
                  {stageCleared ? "Récompense obtenue ✓" : "Récompense (une seule fois)"}
                </p>
                <p className={`tabular-nums ${stageCleared ? "text-fg-faint line-through" : "text-fg"}`}>
                  {stage.reward.gold} or · 💎 {stage.reward.crystals} · ✦ {stage.reward.stardust} · {stage.reward.rankTokens} jeton
                  {stage.reward.rankTokens > 1 ? "s" : ""} de rang · {stage.reward.forgeShards} éclats
                </p>
                <p className="mt-2">
                  <Badge tone={stage.reward.itemRarity}>Objet {RARITY_LABEL[stage.reward.itemRarity].toLowerCase()} ou mieux</Badge>
                </p>
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="font-semibold text-fg">
                  Équipe{" "}
                  <span className="font-normal tabular-nums text-fg-subtle">
                    ({team.length}/{RAID_PARTY_MAX})
                  </span>
                </h2>
                {team.length > 0 && (
                  <span className={`text-xs tabular-nums ${gap >= 0 ? "text-emerald-300" : gap >= -5 ? "text-amber-300" : "text-red-300"}`}>
                    Niveau d&apos;équipe {teamLevel} {gap >= 0 ? "— à la hauteur" : gap >= -5 ? "— serré" : "— très risqué"}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {idleHeroes.map((hero) => {
                  const power = heroPower(resolveHeroStats(hero, equippedItemsOf(hero, items), profile?.componentRanks));
                  return (
                    <Chip key={hero.id} selected={selectedHeroes.includes(hero.id)} onClick={() => toggleHero(hero.id)}>
                      {hero.name}
                      <span className="ml-1 text-xs tabular-nums text-fg-subtle">
                        {tryGetClass(hero.classId)?.name} · niv {hero.level} · 💪{power}
                      </span>
                    </Chip>
                  );
                })}
              </div>
              {idleHeroes.length === 0 && <p className="text-sm text-fg-subtle">Aucun héros disponible (il faut une classe et ne pas être occupé).</p>}
              <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
                Même exploration qu&apos;un raid : carte dans le brouillard, pièges, combats. Atteignez le sceau (salle au trésor) pour gagner.
                Échec ou abandon : aucune perte, vous pouvez réessayer.
              </p>
              {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
              <Button
                size="lg"
                onClick={start}
                disabled={starting || team.length === 0 || !!activeRaid || !isStageUnlocked(stage, cleared)}
                className="mt-4 w-full"
              >
                {starting ? "Préparation..." : stageCleared ? "Rejouer (sans récompense)" : "Entrer dans le donjon"}
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
