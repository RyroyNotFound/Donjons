"use client";

import { useParams } from "next/navigation";
import { useState, ViewTransition } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { CLASSES, tryGetClass } from "@/lib/game/content/classes";
import { getTalentsForClass } from "@/lib/game/content/talents";
import { heroElement, resolveHeroStats } from "@/lib/game/engine/stats";
import { ELEMENT_ICON, ELEMENT_LABEL, ELEMENTS, RES_KEY } from "@/lib/game/engine/elements";
import { ITEM_RARITIES, itemTotalStats } from "@/lib/game/engine/items";
import { formatStatBonus } from "@/lib/game/statFormat";
import { cleanPlayerName, heroNameError, HERO_NAME_MAX } from "@/lib/game/playerName";
import { RARITY_LABEL, RARITY_OPTION_STYLE } from "@/lib/ui/rarity";
import { xpToNextLevel } from "@/lib/game/engine/xp";
import { MAX_STAR_RANK, MAX_COMPONENT_RANK, levelCapForStar, rankUpCost } from "@/lib/game/economy";
import { callApi } from "@/lib/api/client";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Label, selectClass, inputClass } from "@/components/Field";
import { Panel } from "@/components/Panel";
import { EmptyState } from "@/components/EmptyState";
import { ItemCard } from "@/components/forge/ItemCard";
import { SpellList, MasteryList } from "@/components/heroes/LoadoutLists";
import { sharedBuilds, MAX_SHARED_BUILDS } from "@/lib/game/builds";
import { tryGetSpell } from "@/lib/game/content/spells";
import { getMastery } from "@/lib/game/content/masteries";
import { PageTransition } from "@/components/PageTransition";
import { SpriteAnimation } from "@/components/SpriteAnimation";
import { HERO_SPRITE_BY_ROLE, CLASS_TINT } from "@/lib/ui/heroSprites";
import { ROLE_LABEL } from "@/lib/ui/role";
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
  const [renaming, setRenaming] = useState<string | null>(null);

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
  // Free items of the slot (plus this hero's own), rarest first, then highest tier / enhancement.
  const itemsForSlot = (slot: ItemSlot) =>
    items
      .filter((i) => i.slot === slot && (!i.equippedByHeroId || i.equippedByHeroId === hero.id))
      .sort(
        (a, b) =>
          ITEM_RARITIES.indexOf(b.rarity) - ITEM_RARITIES.indexOf(a.rarity) ||
          (b.tier ?? 1) - (a.tier ?? 1) ||
          (b.enhanceLevel ?? 0) - (a.enhanceLevel ?? 0),
      );
  const builds = sharedBuilds(profile, heroes);

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
  const renameError = renaming === null ? null : heroNameError(cleanPlayerName(renaming));
  const rename = () =>
    run(async () => {
      await callApi(`/api/heroes/${hero!.id}/rename`, { name: cleanPlayerName(renaming ?? "") });
      setRenaming(null);
    });
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
                  {classDef.name} · {ROLE_LABEL[classDef.role]} · Niveau {hero.level}/{levelCapForStar(hero.starRank ?? 1)}
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

      {renaming === null ? (
        <button
          type="button"
          onClick={() => setRenaming(hero.name)}
          className="-mt-4 text-xs text-slate-500 underline-offset-2 hover:text-amber-300 hover:underline"
        >
          ✎ Renommer
        </button>
      ) : (
        <form
          className="-mt-2 flex flex-wrap items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!renameError) rename();
          }}
        >
          <div>
            <input
              autoFocus
              className={`${inputClass} max-w-xs`}
              value={renaming}
              maxLength={HERO_NAME_MAX}
              onChange={(e) => setRenaming(e.target.value)}
              aria-label="Nouveau nom"
            />
            {renameError && <p className="mt-1 text-xs text-red-400">{renameError}</p>}
          </div>
          <Button size="sm" type="submit" disabled={busy || !!renameError}>
            Valider
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setRenaming(null)}>
            Annuler
          </Button>
        </form>
      )}

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
              disabled={busy || hero.status !== "idle"}
              value={hero.classId ?? ""}
              onChange={(e) => e.target.value && assignClass(e.target.value)}
              className={`${selectClass} max-w-xs`}
            >
              <option value="" disabled>
                — Choisir une classe —
              </option>
              {CLASSES.filter((c) => profile.unlockedClasses.includes(c.id)).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({ROLE_LABEL[c.role]})
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
            <Panel as="li" padding="sm">Critique : {stats.crit}%</Panel>
            <Panel as="li" padding="sm">Dégâts crit. : +{stats.critDmg}%</Panel>
            <Panel as="li" padding="sm" className="col-span-2">Rés. pièges (raids) : {stats.trapRes}%</Panel>
          </ul>
          {(() => {
            const magic = stats.atkMag > stats.atkPhys;
            const used = magic ? stats.atkMag : stats.atkPhys;
            const unused = magic ? stats.atkPhys : stats.atkMag;
            return (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-slate-400">
                <p>
                  Attaque utilisée :{" "}
                  <span className={magic ? "text-violet-300" : "text-amber-200"}>
                    {magic ? "magique" : "physique"} ({used})
                  </span>
                  {unused > 0 && <span className="text-slate-500"> — l&apos;autre ({unused}) ne sert pas</span>}
                </p>
                <p className="mt-1 text-slate-500">
                  Un héros frappe toujours avec la plus haute de ses deux attaques, et la cible réduit le coup avec sa
                  défense <em>du même type</em> : défense physique contre les coups physiques, défense magique contre les
                  sorts. Mieux vaut donc tout miser sur un seul type (armes, maîtrises, talents), et viser l&apos;autre
                  type si la cible a une grosse défense dans le vôtre. Presque tous les monstres frappent en physique,
                  la Liche des ombres en magique.
                </p>
              </div>
            );
          })()}
          {(() => {
            const element = heroElement(hero);
            return (
              <p className="mt-3 text-xs text-slate-400">
                Affinité :{" "}
                {element ? (
                  <span className="text-slate-200">
                    {ELEMENT_ICON[element]} {ELEMENT_LABEL[element]}
                  </span>
                ) : (
                  <span className="text-slate-500">neutre (équipez un sort élémentaire)</span>
                )}
              </p>
            );
          })()}
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">
            {ELEMENTS.map((element) => {
              const value = stats[RES_KEY[element]];
              return (
                <li
                  key={element}
                  title={`Résistance ${ELEMENT_LABEL[element].toLowerCase()}`}
                  className={`rounded-full border border-white/10 px-2 py-0.5 ${value > 0 ? "text-emerald-300" : value < 0 ? "text-red-400" : "text-slate-500"}`}
                >
                  {ELEMENT_ICON[element]} {value}%
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <h2 className="font-display mb-3 font-semibold text-slate-50">Équipement</h2>
          <div className="space-y-3">
            {SLOTS.map((slot) => {
              const currentId = hero.equipment[slot];
              const options = itemsForSlot(slot);
              const currentItem = currentId ? items.find((i) => i.id === currentId) : undefined;
              return (
                <div key={slot}>
                  <Label>{SLOT_LABEL[slot]}</Label>
                  <select
                    disabled={busy}
                    value={currentId ?? ""}
                    onChange={(e) => equip(slot, e.target.value || null)}
                    className={selectClass}
                    style={currentItem ? RARITY_OPTION_STYLE[currentItem.rarity] : undefined}
                  >
                    <option value="" style={RARITY_OPTION_STYLE.none}>
                      — Aucun —
                    </option>
                    {options.map((item) => (
                      <option key={item.id} value={item.id} style={RARITY_OPTION_STYLE[item.rarity]}>
                        [{RARITY_LABEL[item.rarity]}] {item.name}
                        {item.enhanceLevel ? ` +${item.enhanceLevel}` : ""} — {formatStatBonus(itemTotalStats(item))}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const current = currentId ? items.find((i) => i.id === currentId) : undefined;
                    return current ? (
                      <div className="mt-2">
                        <ItemCard item={current} />
                      </div>
                    ) : null;
                  })()}
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
        <SpellList hero={hero} ranks={ranks} busy={busy} onToggle={toggleLoadout} />
        <MasteryList hero={hero} ranks={ranks} busy={busy} onToggle={toggleLoadout} />
      </div>

      {classDef && (
        <Card>
          <h2 className="font-display mb-1 font-semibold text-slate-50">Arbre de talents — {classDef.name}</h2>
          <p className="mb-1 text-sm text-slate-400">
            Points disponibles : <span className="text-amber-400">{hero.talentPoints}</span>
          </p>
          <p className="mb-4 text-xs text-slate-500">
            1 point par niveau gagné (expéditions). Un talent obtenu à l&apos;invocation s&apos;active en y investissant
            des points ; il reste actif tant que ce héros garde cette classe. Les talents non obtenus sont grisés.
          </p>
          {(() => {
            const tree = getTalentsForClass(hero.classId!);
            return (
              <div className="grid gap-3 sm:grid-cols-2">
                {tree.map((node) => {
                  const owned = (ranks[node.id] ?? 0) > 0;
                  const invested = hero.talents[node.id] ?? 0;
                  const maxed = invested >= node.maxRank;
                  const starOk = !node.requiresStarRank || (hero.starRank ?? 1) >= node.requiresStarRank;
                  const canAfford = hero.talentPoints >= node.cost;
                  const canSpend = owned && !maxed && starOk && canAfford && !busy;
                  const componentRank = ranks[node.id] ?? 1;

                  if (!owned) {
                    return (
                      <Panel key={node.id} className="opacity-50">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-slate-300">{node.name}</p>
                          <span className="text-xs text-slate-500">Palier {node.tier}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{node.description}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{formatStatBonus(node.statBonusPerRank)} par rang</p>
                        <p className="mt-2 text-xs text-slate-500">🔒 À obtenir à l&apos;invocation ou à l&apos;Observatoire</p>
                      </Panel>
                    );
                  }

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
                      {!starOk && <p className="mt-1 text-xs text-red-400">Nécessite {node.requiresStarRank}★</p>}
                      {!maxed && starOk && !canAfford && (
                        <p className="mt-1 text-xs text-slate-500">
                          {node.cost} point{node.cost > 1 ? "s" : ""} requis (vous en avez {hero.talentPoints})
                        </p>
                      )}
                      <Button
                        size="sm"
                        onClick={() => spendTalent(node.id)}
                        disabled={!canSpend}
                        className="mt-2 w-full"
                      >
                        {maxed ? "Maîtrisé" : invested === 0 ? `Activer (${node.cost} pt)` : `Améliorer (${node.cost} pt)`}
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
          Sauvegardez la classe + les sorts/maîtrises équipés de ce héros. Les ensembles sont communs à tous vos
          héros ({builds.length}/{MAX_SHARED_BUILDS}) : appliquez-en un à n&apos;importe lequel. Les talents n&apos;en
          font pas partie.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            className={`${inputClass} max-w-xs`}
            placeholder="Nom de l'ensemble"
            value={buildName}
            maxLength={40}
            onChange={(e) => setBuildName(e.target.value)}
          />
          <Button size="sm" onClick={saveBuild} disabled={busy || !buildName.trim() || builds.length >= MAX_SHARED_BUILDS}>
            Sauvegarder la config actuelle
          </Button>
        </div>
        {builds.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun ensemble sauvegardé.</p>
        ) : (
          <div className="space-y-2">
            {builds.map((build) => (
              <Panel key={build.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-100">{build.name}</p>
                  <p className="text-xs text-slate-400">
                    {tryGetClass(build.classId)?.name ?? "Sans classe"}
                    {build.equippedSpellIds.length > 0 &&
                      ` · ${build.equippedSpellIds.map((id) => tryGetSpell(id)?.name ?? "?").join(", ")}`}
                  </p>
                  {build.equippedMasteryIds.length > 0 && (
                    <p className="text-xs text-slate-500">
                      {build.equippedMasteryIds
                        .map((id) => {
                          try {
                            return getMastery(id).name;
                          } catch {
                            return "?";
                          }
                        })
                        .join(", ")}
                    </p>
                  )}
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
