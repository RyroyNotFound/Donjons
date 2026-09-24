"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, ViewTransition } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { CLASSES, tryGetClass } from "@/lib/game/content/classes";
import { SPELLS } from "@/lib/game/content/spells";
import { MASTERIES } from "@/lib/game/content/masteries";
import { getTalentsForClass } from "@/lib/game/content/talents";
import { resolveHeroStats } from "@/lib/game/engine/stats";
import { formatStatBonus, RAID_EFFECT_LABEL, ARENA_EFFECT_LABEL } from "@/lib/game/statFormat";
import { xpToNextLevel } from "@/lib/game/engine/xp";
import {
  MAX_STAR_RANK,
  MAX_COMPONENT_RANK,
  SPELL_SLOTS,
  MASTERY_SLOTS,
  levelCapForStar,
  rankUpCost,
} from "@/lib/game/economy";
import { callApi } from "@/lib/api/client";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Label, selectClass, inputClass } from "@/components/Field";
import { Panel } from "@/components/Panel";
import { EmptyState } from "@/components/EmptyState";
import { PageTransition } from "@/components/PageTransition";
import { SpriteAnimation } from "@/components/SpriteAnimation";
import { HERO_SPRITE_BY_ROLE, CLASS_TINT } from "@/lib/ui/heroSprites";
import type { Item, ItemSlot } from "@/types/game";

const SLOTS: ItemSlot[] = ["weapon", "armor", "trinket"];
const SLOT_LABEL: Record<ItemSlot, string> = {
  weapon: "Arme",
  armor: "Armure",
  trinket: "Babiole",
};

export default function HeroDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { heroes, items, profile } = useGameData();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [buildName, setBuildName] = useState("");

  const hero = heroes.find((h) => h.id === id);
  if (!hero || !profile) {
    return (
      <PageTransition>
        <EmptyState message="Héros introuvable." backHref="/heros" backLabel="Retour aux héros" />
      </PageTransition>
    );
  }

  const classDef = tryGetClass(hero.classId);
  const ranks = profile.componentRanks;
  const equippedItems = SLOTS.map((slot) =>
    hero.equipment[slot] ? items.find((i) => i.id === hero.equipment[slot]) : undefined,
  ).filter(Boolean) as Item[];
  const stats = resolveHeroStats(hero, equippedItems, ranks);
  const ownedUnequippedBySlot = (slot: ItemSlot) =>
    items.filter((i) => i.slot === slot && (!i.equippedByHeroId || i.equippedByHeroId === hero.id));

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const assignClass = (classId: string) => run(() => callApi(`/api/heroes/${hero!.id}/class`, { classId }));
  const spendTalent = (nodeId: string) => run(() => callApi(`/api/heroes/${hero!.id}/talents`, { nodeId }));
  const equip = (slot: ItemSlot, itemId: string | null) =>
    run(() => callApi(`/api/heroes/${hero!.id}/equip`, { slot, itemId }));
  const ascend = () => run(() => callApi(`/api/heroes/${hero!.id}/ascend`));
  const toggleLoadout = (kind: "spell" | "mastery", refId: string, equipIt: boolean) =>
    run(() => callApi(`/api/heroes/${hero!.id}/loadout`, { kind, refId, equip: equipIt }));
  const applyBuild = (buildId: string) => run(() => callApi(`/api/heroes/${hero!.id}/builds`, { action: "apply", buildId }));
  const deleteBuild = (buildId: string) => run(() => callApi(`/api/heroes/${hero!.id}/builds`, { action: "delete", buildId }));
  const saveBuild = () =>
    run(async () => {
      await callApi(`/api/heroes/${hero!.id}/builds`, { action: "save", name: buildName });
      setBuildName("");
    });

  return (
    <PageTransition>
    <div className="space-y-6">
      <ViewTransition name={`hero-title-${hero.id}`}>
        <div className="flex items-center gap-4">
          {classDef && (
            <SpriteAnimation
              sheet={HERO_SPRITE_BY_ROLE[classDef.role]}
              frames={4}
              frameSize={32}
              tint={CLASS_TINT[classDef.id]}
              className="h-16 w-16"
            />
          )}
          <PageHeader
            title={hero.name}
            subtitle={
              classDef ? (
                <>
                  {classDef.name} · {classDef.role} · Niveau {hero.level}/{levelCapForStar(hero.starRank ?? 1)}
                  <span className="ml-2 text-amber-400">
                    {"★".repeat(hero.starRank ?? 1)}
                    {"☆".repeat(MAX_STAR_RANK - (hero.starRank ?? 1))}
                  </span>
                </>
              ) : (
                "Sans classe — assignez-en une pour le rendre jouable"
              )
            }
          />
        </div>
      </ViewTransition>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Card accent={classDef ? undefined : "gold"}>
        <h2 className="font-display mb-3 font-semibold text-slate-50">Classe</h2>
        {profile.unlockedClasses.length === 0 ? (
          <p className="text-sm text-slate-400">
            Aucune classe obtenue pour l&apos;instant — tentez votre chance à l&apos;invocation.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <select
              disabled={busy}
              value={hero.classId ?? ""}
              onChange={(e) => e.target.value && assignClass(e.target.value)}
              className={`${selectClass} max-w-xs`}
            >
              <option value="" disabled>
                — Choisir une classe —
              </option>
              {CLASSES.filter((c) => profile.unlockedClasses.includes(c.id)).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.role})
                </option>
              ))}
            </select>
            {classDef && (
              <p className="text-xs text-slate-500">
                Forces : {classDef.strengths} — Faiblesses : {classDef.weaknesses}
              </p>
            )}
          </div>
        )}
        {hero.status !== "idle" && (
          <p className="mt-2 text-xs text-amber-400">Rendez ce héros disponible pour changer de classe.</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display mb-3 font-semibold text-slate-50">Statistiques</h2>
          <div className="mb-3">
            <p className="mb-1 text-xs text-slate-500">
              XP {hero.xp}/{xpToNextLevel(hero.level)}
            </p>
            <ProgressBar value={hero.xp} max={xpToNextLevel(hero.level)} />
          </div>
          <ul className="grid grid-cols-2 gap-2 text-sm text-slate-300">
            <Panel as="li" padding="sm">PV : {stats.hp}</Panel>
            <Panel as="li" padding="sm">Vitesse : {stats.spd}</Panel>
            <Panel as="li" padding="sm">Attaque phys. : {stats.atkPhys}</Panel>
            <Panel as="li" padding="sm">Attaque mag. : {stats.atkMag}</Panel>
            <Panel as="li" padding="sm">Défense phys. : {stats.defPhys}</Panel>
            <Panel as="li" padding="sm">Défense mag. : {stats.defMag}</Panel>
          </ul>
        </Card>

        <Card>
          <h2 className="font-display mb-3 font-semibold text-slate-50">Équipement</h2>
          <div className="space-y-3">
            {SLOTS.map((slot) => {
              const currentId = hero.equipment[slot];
              const options = ownedUnequippedBySlot(slot);
              return (
                <div key={slot}>
                  <Label>{SLOT_LABEL[slot]}</Label>
                  <select
                    disabled={busy}
                    value={currentId ?? ""}
                    onChange={(e) => equip(slot, e.target.value || null)}
                    className={selectClass}
                  >
                    <option value="">— Aucun —</option>
                    {options.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.rarity})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card accent="gold">
        <h2 className="font-display mb-3 font-semibold text-slate-50">Ascension</h2>
        {!classDef ? (
          <p className="text-sm text-slate-400">Assignez une classe avant de monter ce héros en rang.</p>
        ) : (hero.starRank ?? 1) >= MAX_STAR_RANK ? (
          <p className="text-sm text-slate-400">Rang maximum atteint.</p>
        ) : (
          (() => {
            const cost = rankUpCost(hero.starRank ?? 1);
            const canAscend =
              !busy && profile.rankTokens >= cost.rankTokens && profile.gold >= cost.gold;
            return (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <p className="text-slate-400">
                  Coût : {cost.rankTokens} jeton{cost.rankTokens > 1 ? "s" : ""} de rang ({profile.rankTokens}{" "}
                  dispo) + {cost.gold} or
                </p>
                <Button size="sm" onClick={ascend} disabled={!canAscend}>
                  Monter en étoile
                </Button>
              </div>
            );
          })()
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display mb-1 font-semibold text-slate-50">Sorts</h2>
          <p className="mb-3 text-sm text-slate-400">
            Emplacements : {hero.equippedSpellIds.length}/{SPELL_SLOTS} — utilisables sur n&apos;importe quel
            héros ; la classe assortie donne un bonus de puissance.
          </p>
          {(() => {
            const ownedSpells = SPELLS.filter((spell) => (ranks[spell.id] ?? 0) > 0);
            if (ownedSpells.length === 0) {
              return (
                <p className="text-sm text-slate-500">
                  Aucun sort obtenu — voir l&apos;
                  <Link href="/heros/inventaire" transitionTypes={["nav-forward"]} className="text-amber-400 underline">
                    inventaire
                  </Link>
                  .
                </p>
              );
            }
            return (
              <div className="space-y-2">
                {ownedSpells.map((spell) => {
                  const equipped = hero.equippedSpellIds.includes(spell.id);
                  const full = !equipped && hero.equippedSpellIds.length >= SPELL_SLOTS;
                  const rank = ranks[spell.id] ?? 1;
                  const classMatch = !!spell.classId && spell.classId === hero.classId;
                  return (
                    <Panel
                      key={spell.id}
                      tone={equipped ? "highlight" : "neutral"}
                      className="flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-medium text-slate-100">
                          {spell.name} <span className="text-xs text-slate-500">Rang {rank}/{MAX_COMPONENT_RANK}</span>
                          {classMatch && (
                            <span className="ml-1 text-xs text-emerald-400">★ bonus de classe</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">{spell.description}</p>
                        <p className="mt-0.5 text-xs text-amber-400">
                          Donjon : {RAID_EFFECT_LABEL[spell.raidEffectTag]}
                        </p>
                        <p className="text-xs text-sky-400">{ARENA_EFFECT_LABEL[spell.arenaAbilityTag]}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => toggleLoadout("spell", spell.id, !equipped)}
                        disabled={busy || full}
                      >
                        {equipped ? "Retirer" : "Équiper"}
                      </Button>
                    </Panel>
                  );
                })}
              </div>
            );
          })()}
        </Card>

        <Card>
          <h2 className="font-display mb-1 font-semibold text-slate-50">Maîtrises</h2>
          <p className="mb-3 text-sm text-slate-400">
            Emplacements : {hero.equippedMasteryIds.length}/{MASTERY_SLOTS} — universelles, disponibles sans
            classe.
          </p>
          {(() => {
            const ownedMasteries = MASTERIES.filter((m) => (ranks[m.id] ?? 0) > 0);
            if (ownedMasteries.length === 0) {
              return (
                <p className="text-sm text-slate-500">
                  Aucune maîtrise obtenue — voir l&apos;
                  <Link href="/heros/inventaire" transitionTypes={["nav-forward"]} className="text-amber-400 underline">
                    inventaire
                  </Link>
                  .
                </p>
              );
            }
            return (
              <div className="space-y-2">
                {ownedMasteries.map((mastery) => {
                  const equipped = hero.equippedMasteryIds.includes(mastery.id);
                  const full = !equipped && hero.equippedMasteryIds.length >= MASTERY_SLOTS;
                  const rank = ranks[mastery.id] ?? 1;
                  return (
                    <Panel
                      key={mastery.id}
                      tone={equipped ? "highlight" : "neutral"}
                      className="flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-medium text-slate-100">
                          {mastery.name} <span className="text-xs text-slate-500">Rang {rank}/{MAX_COMPONENT_RANK}</span>
                        </p>
                        <p className="text-xs text-slate-400">{mastery.description}</p>
                        <p className="mt-0.5 text-xs text-amber-400">{formatStatBonus(mastery.statBonus)}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => toggleLoadout("mastery", mastery.id, !equipped)}
                        disabled={busy || full}
                      >
                        {equipped ? "Retirer" : "Équiper"}
                      </Button>
                    </Panel>
                  );
                })}
              </div>
            );
          })()}
        </Card>
      </div>

      {classDef && (
        <Card>
          <h2 className="font-display mb-1 font-semibold text-slate-50">Arbre de talents — {classDef.name}</h2>
          <p className="mb-4 text-sm text-slate-400">
            Points disponibles : <span className="text-amber-400">{hero.talentPoints}</span>
          </p>
          {(() => {
            const ownedTalents = getTalentsForClass(hero.classId!).filter((node) => (ranks[node.id] ?? 0) > 0);
            if (ownedTalents.length === 0) {
              return (
                <p className="text-sm text-slate-500">
                  Aucun talent obtenu pour {classDef.name} — voir l&apos;
                  <Link href="/heros/inventaire" transitionTypes={["nav-forward"]} className="text-amber-400 underline">
                    inventaire
                  </Link>
                  .
                </p>
              );
            }
            return (
              <div className="grid gap-3 sm:grid-cols-2">
                {ownedTalents.map((node) => {
                  const invested = hero.talents[node.id] ?? 0;
                  const maxed = invested >= node.maxRank;
                  const prereqOk = !node.requires || (hero.talents[node.requires] ?? 0) > 0;
                  const starOk = !node.requiresStarRank || (hero.starRank ?? 1) >= node.requiresStarRank;
                  const canAfford = hero.talentPoints >= node.cost;
                  const canSpend = !maxed && prereqOk && starOk && canAfford && !busy;
                  const componentRank = ranks[node.id] ?? 1;

                  return (
                    <Panel key={node.id} tone={maxed ? "highlight" : "neutral"}>
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-100">
                          {node.name}{" "}
                          <span className="text-xs text-slate-600">
                            (rang {componentRank}/{MAX_COMPONENT_RANK})
                          </span>
                        </p>
                        <span className="text-xs text-slate-500">
                          {invested}/{node.maxRank}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{node.description}</p>
                      <p className="mt-0.5 text-xs text-amber-400">
                        {formatStatBonus(node.statBonusPerRank)} par rang
                      </p>
                      {node.requires && !prereqOk && (
                        <p className="mt-1 text-xs text-red-400">Prérequis manquant</p>
                      )}
                      {!starOk && <p className="mt-1 text-xs text-red-400">Nécessite {node.requiresStarRank}★</p>}
                      <Button
                        size="sm"
                        onClick={() => spendTalent(node.id)}
                        disabled={!canSpend}
                        className="mt-2 w-full"
                      >
                        {maxed ? "Maîtrisé" : `Améliorer (${node.cost} pt)`}
                      </Button>
                    </Panel>
                  );
                })}
              </div>
            );
          })()}
        </Card>
      )}

      <Card>
        <h2 className="font-display mb-1 font-semibold text-slate-50">Ensembles</h2>
        <p className="mb-4 text-sm text-slate-400">
          Sauvegardez la classe + les sorts/maîtrises équipés pour basculer instantanément entre plusieurs
          configurations.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            className={`${inputClass} max-w-xs`}
            placeholder="Nom de l'ensemble"
            value={buildName}
            maxLength={40}
            onChange={(e) => setBuildName(e.target.value)}
          />
          <Button size="sm" onClick={saveBuild} disabled={busy || !buildName.trim()}>
            Sauvegarder la config actuelle
          </Button>
        </div>
        {hero.builds.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun ensemble sauvegardé.</p>
        ) : (
          <div className="space-y-2">
            {hero.builds.map((build) => (
              <Panel key={build.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-100">{build.name}</p>
                  <p className="text-xs text-slate-400">
                    {tryGetClass(build.classId)?.name ?? "Sans classe"} · {build.equippedSpellIds.length} sort(s) ·{" "}
                    {build.equippedMasteryIds.length} maîtrise(s)
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => applyBuild(build.id)} disabled={busy || hero.status !== "idle"}>
                    Appliquer
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => deleteBuild(build.id)} disabled={busy}>
                    Supprimer
                  </Button>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </Card>
    </div>
    </PageTransition>
  );
}
