"use client";

import { useParams } from "next/navigation";
import { useState, ViewTransition } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { tryGetClass } from "@/lib/game/content/classes";
import { equippedItemsOf, resolveHeroStats } from "@/lib/game/engine/stats";
import { cleanPlayerName, heroNameError, HERO_NAME_MAX } from "@/lib/game/playerName";
import { heroTodos, type HeroContext, type HeroTab } from "@/lib/game/heroInsights";
import { MAX_STAR_RANK, levelCapForStar } from "@/lib/game/economy";
import { callApi } from "@/lib/api/client";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { inputClass } from "@/components/Field";
import { Panel } from "@/components/Panel";
import { EmptyState } from "@/components/EmptyState";
import { SpellList, MasteryList } from "@/components/heroes/LoadoutLists";
import { HeroOverview } from "@/components/heroes/HeroOverview";
import { HeroEquipment } from "@/components/heroes/HeroEquipment";
import { HeroTalents } from "@/components/heroes/HeroTalents";
import { sharedBuilds, MAX_SHARED_BUILDS } from "@/lib/game/builds";
import { tryGetSpell } from "@/lib/game/content/spells";
import { getMastery } from "@/lib/game/content/masteries";
import { PageTransition } from "@/components/PageTransition";
import { SpriteAnimation } from "@/components/SpriteAnimation";
import { HERO_SPRITE_BY_ROLE, CLASS_TINT } from "@/lib/ui/heroSprites";
import { ROLE_LABEL } from "@/lib/ui/role";
import { focusRing } from "@/lib/ui/a11y";
import type { ItemSlot } from "@/types/game";

const TABS: { id: HeroTab; label: string }[] = [
  { id: "apercu", label: "Aperçu" },
  { id: "equipement", label: "Équipement" },
  { id: "sorts", label: "Sorts" },
  { id: "maitrises", label: "Maîtrises" },
  { id: "talents", label: "Talents" },
  { id: "ensembles", label: "Ensembles" },
];

export default function HeroDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { heroes, items, profile } = useGameData();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [buildName, setBuildName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [tab, setTab] = useState<HeroTab>("apercu");

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
  const stats = resolveHeroStats(hero, equippedItemsOf(hero, items), ranks);
  const ctx: HeroContext = { hero, items, ranks };
  // Tabs carrying something to fix get a dot (the overview's list says what).
  const todoTabs = new Set(heroTodos(ctx, profile).filter((t) => t.tone !== "info").map((t) => t.tab));
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

      <div role="tablist" className="panel-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative shrink-0 rounded-lg border px-3 py-1.5 text-sm transition ${focusRing} ${
              tab === t.id ? "border-amber-500 bg-amber-500/20 text-amber-300" : "border-white/10 text-slate-300 hover:bg-white/5"
            }`}
          >
            {t.label}
            {t.id !== "apercu" && todoTabs.has(t.id) && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400" aria-label="à améliorer" />
            )}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {tab === "apercu" && (
        <HeroOverview
          ctx={ctx}
          stats={stats}
          classDef={classDef}
          profile={profile}
          busy={busy}
          onAssignClass={assignClass}
          onAscend={ascend}
          goTo={setTab}
        />
      )}
      {tab === "equipement" && <HeroEquipment ctx={ctx} busy={busy} onEquip={equip} />}
      {tab === "sorts" && <SpellList hero={hero} stats={stats} role={classDef?.role} ranks={ranks} busy={busy} onToggle={toggleLoadout} />}
      {tab === "maitrises" && <MasteryList ctx={ctx} busy={busy} onToggle={toggleLoadout} />}
      {tab === "talents" &&
        (classDef ? (
          <HeroTalents ctx={ctx} classDef={classDef} busy={busy} onSpend={spendTalent} />
        ) : (
          <Card>
            <p className="text-sm text-slate-400">Choisissez d&apos;abord une classe (onglet Aperçu) : chaque classe a son arbre de talents.</p>
          </Card>
        ))}

      {tab === "ensembles" && (
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
      )}
    </div>
    </PageTransition>
  );
}
