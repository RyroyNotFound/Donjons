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
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Badge } from "@/components/Badge";
import { PageTransition } from "@/components/PageTransition";
import type { RaidView } from "@/types/game";

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
      className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-center transition disabled:cursor-not-allowed ${
        selected
          ? "border-amber-500 bg-amber-500/20"
          : cleared
            ? "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20"
            : unlocked
              ? "border-amber-400/60 bg-black/30 hover:bg-white/5"
              : "border-white/5 bg-black/20 opacity-40"
      }`}
    >
      <span className="text-lg">{cleared ? "✓" : !unlocked ? "🔒" : stage.isBoss ? "💀" : "⚔️"}</span>
      <span className="text-[11px] tabular-nums text-slate-400">niv {stage.defenseLevel}</span>
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
      <div className="space-y-6">
        <PageHeader
          title="Mode aventure"
          subtitle={`Traversez 5 mondes, donjon après donjon. Chaque premier succès rapporte une récompense unique. Progression : ${clearedCount}/${ADVENTURE_STAGES.length}`}
        />

        {activeRaid && (
          <Card accent="gold">
            <p className="text-sm text-slate-200">
              Un raid est en cours.{" "}
              <Link href={`/donjon/attaquer/raid/${activeRaid}`} className="text-amber-400 underline">
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
                <Card key={w.id} accent={done ? "success" : open ? "default" : undefined}>
                  <div className={open ? "" : "opacity-50"}>
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <p className="font-display font-semibold text-slate-50">
                        {wi + 1}. {w.name}
                      </p>
                      <span className="text-xs text-slate-500">
                        niv {stages[0].defenseLevel}–{stages[stages.length - 1].defenseLevel}
                      </span>
                    </div>
                    <p className="mb-2 text-xs text-slate-400">{w.description}</p>
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
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Monde {stage.worldIndex + 1} · donjon {stage.stageIndex + 1}
                {stage.isBoss && " · boss"}
              </p>
              <h2 className="font-display text-xl font-bold text-slate-50">{stage.name}</h2>
              <p className="mt-1 text-sm text-slate-300">
                Niveau <span className="font-semibold text-amber-300">{stage.defenseLevel}</span> · {intel.roomCount} salles · {intel.monsters}{" "}
                monstre{intel.monsters > 1 ? "s" : ""} · {intel.traps} piège{intel.traps > 1 ? "s" : ""}
                {intel.hasBoss && " · 💀 Liche"}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
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
              <p className="mt-2 text-xs text-slate-500">💡 {world.hint}</p>

              <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                <p className="mb-1 font-semibold text-amber-200">{stageCleared ? "Récompense obtenue ✓" : "Récompense (une seule fois)"}</p>
                <p className={stageCleared ? "text-slate-500 line-through" : "text-slate-300"}>
                  {stage.reward.gold} or · 💎 {stage.reward.crystals} · ✦ {stage.reward.stardust} · {stage.reward.rankTokens} jeton
                  {stage.reward.rankTokens > 1 ? "s" : ""} de rang · {stage.reward.forgeShards} éclats
                </p>
                <p className="mt-1">
                  <Badge tone={stage.reward.itemRarity}>Objet {RARITY_LABEL[stage.reward.itemRarity].toLowerCase()} ou mieux</Badge>
                </p>
              </div>
            </Card>

            <Card>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="font-display font-semibold text-slate-50">
                  Équipe ({team.length}/{RAID_PARTY_MAX})
                </h2>
                {team.length > 0 && (
                  <span className={`text-xs ${gap >= 0 ? "text-emerald-300" : gap >= -5 ? "text-amber-300" : "text-red-300"}`}>
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
                      <span className="ml-1 text-xs text-slate-500">
                        {tryGetClass(hero.classId)?.name} · niv {hero.level} · 💪{power}
                      </span>
                    </Chip>
                  );
                })}
              </div>
              {idleHeroes.length === 0 && <p className="text-sm text-slate-500">Aucun héros disponible (il faut une classe et ne pas être occupé).</p>}
              <p className="mt-3 text-xs text-slate-500">
                Même exploration qu&apos;un raid : carte dans le brouillard, pièges, combats. Atteignez le sceau (salle au trésor) pour gagner.
                Échec ou abandon : aucune perte, vous pouvez réessayer.
              </p>
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              <Button onClick={start} disabled={starting || team.length === 0 || !!activeRaid || !isStageUnlocked(stage, cleared)} className="mt-3 w-full">
                {starting ? "Préparation..." : stageCleared ? "Rejouer (sans récompense)" : "Entrer dans le donjon"}
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
