"use client";

import { useMemo, useState } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { RECIPES } from "@/lib/game/content/recipes";
import {
  AFFIX_COUNT,
  CRAFT_RARITY_WEIGHTS,
  ENHANCE_BONUS_PER_LEVEL,
  ITEM_RARITIES,
  MAX_ENHANCE_LEVEL,
  enhanceCost,
  reforgeCost,
  bulkSalvageable,
  salvageYield,
} from "@/lib/game/engine/items";
import { formatStatBonus, ITEM_SLOT_LABEL } from "@/lib/game/statFormat";
import { RARITY_LABEL } from "@/lib/ui/rarity";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Panel } from "@/components/Panel";
import { ResourcePill } from "@/components/ResourcePill";
import { PageTransition } from "@/components/PageTransition";
import { ItemCard } from "@/components/forge/ItemCard";
import type { Item, ItemRarity, ItemSlot, ResourceKind } from "@/types/game";

const RESOURCE_LABEL: Record<ResourceKind, string> = {
  wood: "Bois",
  ore: "Minerai",
  essence: "Essence",
};

const TIERS = [1, 2, 3];
type Filter = "all" | "free" | ItemSlot;
type RecipeFilter = "all" | "affordable" | ItemSlot;

function formatResources(resources: Partial<Record<ResourceKind, number>>): string {
  return Object.entries(resources)
    .map(([kind, amount]) => `${amount} ${RESOURCE_LABEL[kind as ResourceKind]}`)
    .join(", ");
}

function rarityOdds(tier: number): string {
  const weights = CRAFT_RARITY_WEIGHTS[tier];
  const total = ITEM_RARITIES.reduce((sum, r) => sum + weights[r], 0);
  return ITEM_RARITIES.filter((r) => weights[r] > 0)
    .map((r) => `${RARITY_LABEL[r]} ${Math.round((weights[r] / total) * 100)}%`)
    .join(" · ");
}

export default function ForgePage() {
  const { profile, items, heroes } = useGameData();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastCrafted, setLastCrafted] = useState<Item | null>(null);
  const [confirmSalvage, setConfirmSalvage] = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = useState<ItemRarity | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [recipeFilter, setRecipeFilter] = useState<RecipeFilter>("all");

  const shards = profile?.forgeShards ?? 0;
  const crafted = lastCrafted ? items.find((i) => i.id === lastCrafted.id) : undefined;
  const heroName = (heroId?: string) => heroes.find((h) => h.id === heroId)?.name;

  const sortedItems = useMemo(() => {
    const filtered = items.filter((i) =>
      filter === "all" ? true : filter === "free" ? !i.equippedByHeroId : i.slot === filter,
    );
    return filtered.sort(
      (a, b) =>
        ITEM_RARITIES.indexOf(b.rarity) - ITEM_RARITIES.indexOf(a.rarity) ||
        (b.tier ?? 1) - (a.tier ?? 1) ||
        (b.enhanceLevel ?? 0) - (a.enhanceLevel ?? 0),
    );
  }, [items, filter]);

  function canAfford(gold: number, resources: Partial<Record<ResourceKind, number>> = {}, shardCost = 0) {
    if (!profile) return false;
    if (profile.gold < gold || shards < shardCost) return false;
    return Object.entries(resources).every(
      ([kind, amount]) => (profile.resources[kind as ResourceKind] ?? 0) >= (amount ?? 0),
    );
  }

  async function run(key: string, action: () => Promise<string>) {
    setError(null);
    setMessage(null);
    setBusy(key);
    try {
      setMessage(await action());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      setConfirmSalvage(null);
      setConfirmBulk(null);
    }
  }

  const craft = (recipeId: string) =>
    run(`craft-${recipeId}`, async () => {
      const { item } = await callApi<{ item: Item }>("/api/crafting/craft", { recipeId });
      setLastCrafted(item);
      return `Fabriqué : ${item.name} (${RARITY_LABEL[item.rarity]}) !`;
    });

  const enhance = (item: Item) =>
    run(`enhance-${item.id}`, async () => {
      const res = await callApi<{ success: boolean; enhanceLevel: number }>(`/api/items/${item.id}/enhance`);
      return res.success
        ? `${item.name} passe à +${res.enhanceLevel} !`
        : `Échec de l'amélioration : ${item.name} reste à +${res.enhanceLevel}.`;
    });

  const reforge = (item: Item, affixIndex: number) =>
    run(`reforge-${item.id}`, async () => {
      const res = await callApi<{ item: Item }>(`/api/items/${item.id}/reforge`, { affixIndex });
      const line = res.item.affixes?.[affixIndex];
      return `Réforgé : ${line ? formatStatBonus(line.statBonus) : res.item.name}.`;
    });

  // What "recycle every <rarity>" would destroy and give back, per rarity (preview for the confirm step).
  const bulkBatches = useMemo(() => {
    const batches = Object.fromEntries(
      ITEM_RARITIES.map((r) => [r, { count: 0, shards: 0, resources: {} as Partial<Record<ResourceKind, number>> }]),
    ) as Record<ItemRarity, { count: number; shards: number; resources: Partial<Record<ResourceKind, number>> }>;
    for (const item of items) {
      if (!bulkSalvageable(item)) continue;
      const batch = batches[item.rarity];
      const gained = salvageYield(item);
      batch.count += 1;
      batch.shards += gained.shards;
      for (const [kind, amount] of Object.entries(gained.resources) as [ResourceKind, number][]) {
        batch.resources[kind] = (batch.resources[kind] ?? 0) + amount;
      }
    }
    return batches;
  }, [items]);

  const salvageRarity = (rarity: ItemRarity) =>
    run(`salvage-bulk-${rarity}`, async () => {
      const res = await callApi<{ count: number; shards: number; resources: Partial<Record<ResourceKind, number>> }>(
        "/api/items/salvage-bulk",
        { rarity },
      );
      return `${res.count} objet${res.count > 1 ? "s" : ""} recyclé${res.count > 1 ? "s" : ""} : +${res.shards} éclats${
        formatResources(res.resources) ? `, ${formatResources(res.resources)}` : ""
      }.`;
    });

  const salvage = (item: Item) =>
    run(`salvage-${item.id}`, async () => {
      const res = await callApi<{ shards: number; resources: Partial<Record<ResourceKind, number>> }>(
        `/api/items/${item.id}/salvage`,
      );
      return `Recyclé : +${res.shards} éclats, ${formatResources(res.resources)}.`;
    });


  return (
    <PageTransition>
      <div className="space-y-8">
        <PageHeader
          title="Forge"
          subtitle="Fabriquez, améliorez, réforgez et recyclez votre équipement."
          action={<ResourcePill icon="ore" label="Éclats de forge" value={shards} colorClassName="text-orange-300" />}
        />

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "Toutes les recettes"],
                ["affordable", "Réalisables"],
                ["weapon", ITEM_SLOT_LABEL.weapon],
                ["armor", ITEM_SLOT_LABEL.armor],
                ["trinket", ITEM_SLOT_LABEL.trinket],
              ] as [RecipeFilter, string][]
            ).map(([value, label]) => (
              <Chip key={value} selected={recipeFilter === value} onClick={() => setRecipeFilter(value)}>
                {label}
              </Chip>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-fg-subtle">
            ATQ phys. ou mag. ? Un héros ne frappe qu&apos;avec la plus haute des deux : équipez-le dans le type de son
            attaque principale (voir sa fiche).
          </p>
        </div>

        {TIERS.map((tier) => {
          const recipes = RECIPES.filter(
            (r) =>
              r.tier === tier &&
              (recipeFilter === "all" ||
                (recipeFilter === "affordable" ? canAfford(r.cost.gold, r.cost.resources) : r.result.slot === recipeFilter)),
          );
          if (recipes.length === 0) return null;
          return (
            <section key={tier}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="font-semibold text-fg">Palier {tier}</h2>
                <p className="text-xs tabular-nums text-fg-subtle">{rarityOdds(tier)}</p>
              </div>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {recipes.map((recipe) => (
                  <li
                    key={recipe.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="font-semibold text-fg">{recipe.name}</p>
                        <p className="text-xs text-fg-subtle">
                          {recipe.profession} · {ITEM_SLOT_LABEL[recipe.result.slot]}
                        </p>
                      </div>
                      <p className="mt-0.5 text-sm text-fg-muted">{recipe.description}</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs tabular-nums">
                        <span className="text-fg">
                          Base : {formatStatBonus(recipe.result.statBonus)}{" "}
                          <span className="text-fg-subtle">(augmentée par la rareté)</span>
                        </span>
                        <span className="text-fg-subtle">
                          Coût : {recipe.cost.gold} or, {formatResources(recipe.cost.resources)}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => craft(recipe.id)}
                      disabled={busy !== null || !canAfford(recipe.cost.gold, recipe.cost.resources)}
                      className="w-full sm:w-32"
                    >
                      {busy === `craft-${recipe.id}` ? "Fabrication..." : "Fabriquer"}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {crafted && (
          <div key={crafted.id} className="animate-rise max-w-sm space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">Dernière fabrication</p>
            <ItemCard item={crafted} equippedByName={heroName(crafted.equippedByHeroId)} />
          </div>
        )}

        <section className="space-y-4">
          <div className="space-y-3">
            <div>
              <h2 className="font-semibold text-fg">Atelier</h2>
              <p className="mt-1 text-xs leading-relaxed text-fg-subtle">
                Rareté → nombre d&apos;affixes ({ITEM_RARITIES.map((r) => `${RARITY_LABEL[r]} ${AFFIX_COUNT[r]}`).join(", ")}).
                Amélioration : +{Math.round(ENHANCE_BONUS_PER_LEVEL * 100)}% par niveau, sans risque jusqu&apos;à +5, jamais de rétrogradation.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Tous"],
                  ["free", "Non équipés"],
                  ["weapon", ITEM_SLOT_LABEL.weapon],
                  ["armor", ITEM_SLOT_LABEL.armor],
                  ["trinket", ITEM_SLOT_LABEL.trinket],
                ] as [Filter, string][]
              ).map(([value, label]) => (
                <Chip key={value} selected={filter === value} onClick={() => setFilter(value)}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>

          <Panel>
            <p className="mb-2 text-xs text-fg-muted">
              Recycler toute une rareté — les objets équipés et les objets améliorés (+1 ou plus) sont épargnés.
            </p>
            <div className="flex flex-wrap gap-2">
              {ITEM_RARITIES.map((rarity) => {
                const batch = bulkBatches[rarity];
                if (batch.count === 0) return null;
                const confirming = confirmBulk === rarity;
                return (
                  <div key={rarity} className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant={confirming ? "danger" : "secondary"}
                      className="h-auto! min-h-8 whitespace-normal! py-1.5 text-left tabular-nums"
                      disabled={busy !== null}
                      onClick={() => (confirming ? salvageRarity(rarity) : setConfirmBulk(rarity))}
                    >
                      {confirming
                        ? `Confirmer : détruire ${batch.count} objet${batch.count > 1 ? "s" : ""} (+${batch.shards} éclats${
                            formatResources(batch.resources) ? `, ${formatResources(batch.resources)}` : ""
                          })`
                        : `Recycler tous les ${RARITY_LABEL[rarity].toLowerCase()}s (${batch.count})`}
                    </Button>
                    {confirming && (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmBulk(null)}>
                        Annuler
                      </Button>
                    )}
                  </div>
                );
              })}
              {ITEM_RARITIES.every((r) => bulkBatches[r].count === 0) && (
                <p className="text-xs text-fg-subtle">Rien à recycler en masse.</p>
              )}
            </div>
          </Panel>

          {sortedItems.length === 0 && <p className="text-sm text-fg-subtle">Aucun objet.</p>}
          {sortedItems.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {sortedItems.map((item) => {
                const level = item.enhanceLevel ?? 0;
                const enhanceInfo = enhanceCost(item);
                const reforgeInfo = reforgeCost(item);
                const salvageInfo = salvageYield(item);
                const hasAffixes = (item.affixes ?? []).length > 0;
                return (
                  <li key={item.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:gap-6">
                    <div className="min-w-0 flex-1">
                      <ItemCard
                        plain
                        item={item}
                        equippedByName={heroName(item.equippedByHeroId)}
                        onRerollAffix={hasAffixes ? (i) => reforge(item, i) : undefined}
                        rerollLabel={
                          busy === null && canAfford(reforgeInfo.gold, {}, reforgeInfo.shards)
                            ? `${reforgeInfo.gold} or, ${reforgeInfo.shards} éclats`
                            : undefined
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2 lg:w-80 lg:shrink-0">
                      {level < MAX_ENHANCE_LEVEL ? (
                        <Button
                          className="h-auto! min-h-10 w-full flex-wrap gap-y-0 whitespace-normal! py-2 text-center tabular-nums"
                          disabled={busy !== null || !canAfford(enhanceInfo.gold, {}, enhanceInfo.shards)}
                          onClick={() => enhance(item)}
                        >
                          Améliorer → +{level + 1}
                          <span className="text-xs font-normal opacity-75">
                            ({enhanceInfo.gold} or, {enhanceInfo.shards} éclats
                            {enhanceInfo.successChance < 1 && `, ${Math.round(enhanceInfo.successChance * 100)}%`})
                          </span>
                        </Button>
                      ) : (
                        <p className="flex h-10 items-center justify-center rounded-lg border border-gold/25 bg-gold/[0.06] text-xs font-medium text-gold">
                          Amélioration maximale
                        </p>
                      )}
                      {!item.equippedByHeroId && (
                        <Button
                          size="sm"
                          variant={confirmSalvage === item.id ? "danger" : "ghost"}
                          className="h-auto! min-h-8 w-full whitespace-normal! py-1.5 text-center tabular-nums"
                          disabled={busy !== null}
                          onClick={() => (confirmSalvage === item.id ? salvage(item) : setConfirmSalvage(item.id))}
                        >
                          {confirmSalvage === item.id
                            ? "Confirmer le recyclage"
                            : `Recycler (+${salvageInfo.shards} éclats, ${formatResources(salvageInfo.resources)})`}
                        </Button>
                      )}
                      {hasAffixes && (
                        <p className="text-center text-[11px] leading-snug text-fg-subtle">
                          Réforge : {reforgeInfo.gold} or, {reforgeInfo.shards} éclats par ligne (↻) — les autres lignes, la base et l&apos;amélioration sont conservées
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {(error || message) && (
        <div
          key={error ?? message}
          role="status"
          className="animate-pop bottom-toast fixed left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-xl border border-line-strong bg-surface-2 px-4 py-3 text-sm text-fg shadow-[0_16px_40px_-12px_rgb(0_0_0/0.7)]"
        >
          <span
            aria-hidden
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              error ? "bg-red-400/15 text-red-300" : "bg-emerald-400/15 text-emerald-300"
            }`}
          >
            {error ? (
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <path d="M8 4v5M8 12h.01" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <p className="min-w-0 flex-1 leading-snug">{error ?? message}</p>
        </div>
      )}
    </PageTransition>
  );
}
