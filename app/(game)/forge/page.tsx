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
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
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
      <div className="space-y-6">
        <PageHeader
          title="Forge"
          subtitle="Fabriquez, améliorez, réforgez et recyclez votre équipement."
          action={<ResourcePill icon="ore" label="Éclats de forge" value={shards} colorClassName="text-orange-300" />}
        />

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
        <p className="text-xs text-slate-500">
          ATQ phys. ou mag. ? Un héros ne frappe qu&apos;avec la plus haute des deux : équipez-le dans le type de son
          attaque principale (voir sa fiche).
        </p>

        {TIERS.map((tier) => {
          const recipes = RECIPES.filter(
            (r) =>
              r.tier === tier &&
              (recipeFilter === "all" ||
                (recipeFilter === "affordable" ? canAfford(r.cost.gold, r.cost.resources) : r.result.slot === recipeFilter)),
          );
          if (recipes.length === 0) return null;
          return (
          <section key={tier} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-slate-50">Palier {tier}</h2>
              <p className="text-xs text-slate-500">{rarityOdds(tier)}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recipes.map((recipe) => (
                <Card key={recipe.id}>
                  <p className="font-display font-semibold text-slate-50">{recipe.name}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {recipe.profession} · {ITEM_SLOT_LABEL[recipe.result.slot]}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">{recipe.description}</p>
                  <p className="mt-2 text-xs text-amber-300">
                    Base : {formatStatBonus(recipe.result.statBonus)} (augmentée par la rareté)
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Coût : {recipe.cost.gold} or, {formatResources(recipe.cost.resources)}
                  </p>
                  <Button
                    onClick={() => craft(recipe.id)}
                    disabled={busy !== null || !canAfford(recipe.cost.gold, recipe.cost.resources)}
                    className="mt-3 w-full"
                  >
                    {busy === `craft-${recipe.id}` ? "Fabrication..." : "Fabriquer"}
                  </Button>
                </Card>
              ))}
            </div>
          </section>
          );
        })}

        {crafted && (
          <div className="max-w-sm space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-500">Dernière fabrication</p>
            <ItemCard item={crafted} equippedByName={heroName(crafted.equippedByHeroId)} />
          </div>
        )}

        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-semibold text-slate-50">Atelier</h2>
              <p className="text-xs text-slate-500">
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

          <div className="mb-4 rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="mb-2 text-xs text-slate-400">
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
                      variant={confirming ? "danger" : "ghost"}
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
                      <Button size="sm" variant="secondary" onClick={() => setConfirmBulk(null)}>
                        Annuler
                      </Button>
                    )}
                  </div>
                );
              })}
              {ITEM_RARITIES.every((r) => bulkBatches[r].count === 0) && (
                <p className="text-xs text-slate-500">Rien à recycler en masse.</p>
              )}
            </div>
          </div>

          {sortedItems.length === 0 && <p className="text-sm text-slate-500">Aucun objet.</p>}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedItems.map((item) => {
              const level = item.enhanceLevel ?? 0;
              const enhanceInfo = enhanceCost(item);
              const reforgeInfo = reforgeCost(item);
              const salvageInfo = salvageYield(item);
              const hasAffixes = (item.affixes ?? []).length > 0;
              return (
                <li key={item.id} className="flex">
                    <ItemCard
                      item={item}
                      equippedByName={heroName(item.equippedByHeroId)}
                      onRerollAffix={hasAffixes ? (i) => reforge(item, i) : undefined}
                      rerollLabel={
                        busy === null && canAfford(reforgeInfo.gold, {}, reforgeInfo.shards)
                          ? `${reforgeInfo.gold} or, ${reforgeInfo.shards} éclats`
                          : undefined
                      }
                    >
                      <div className="space-y-2">
                        {level < MAX_ENHANCE_LEVEL ? (
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={busy !== null || !canAfford(enhanceInfo.gold, {}, enhanceInfo.shards)}
                            onClick={() => enhance(item)}
                          >
                            Améliorer → +{level + 1} ({enhanceInfo.gold} or, {enhanceInfo.shards} éclats
                            {enhanceInfo.successChance < 1 && `, ${Math.round(enhanceInfo.successChance * 100)}%`})
                          </Button>
                        ) : (
                          <p className="text-center text-xs text-amber-300">Amélioration maximale</p>
                        )}
                        {hasAffixes && (
                          <p className="text-center text-[11px] text-slate-500">
                            Réforge : {reforgeInfo.gold} or, {reforgeInfo.shards} éclats par ligne (↻) — les autres lignes, la base et l&apos;amélioration sont conservées
                          </p>
                        )}
                        {!item.equippedByHeroId && (
                          <Button
                            size="sm"
                            variant={confirmSalvage === item.id ? "danger" : "ghost"}
                            className="w-full"
                            disabled={busy !== null}
                            onClick={() => (confirmSalvage === item.id ? salvage(item) : setConfirmSalvage(item.id))}
                          >
                            {confirmSalvage === item.id
                              ? "Confirmer le recyclage"
                              : `Recycler (+${salvageInfo.shards} éclats, ${formatResources(salvageInfo.resources)})`}
                          </Button>
                        )}
                      </div>
                    </ItemCard>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {(error || message) && (
        <div
          role="status"
          className={`fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border px-4 py-2 text-sm shadow-lg shadow-black/50 backdrop-blur ${
            error ? "border-red-500/50 bg-red-950/80 text-red-300" : "border-emerald-500/50 bg-emerald-950/80 text-emerald-300"
          }`}
        >
          {error ?? message}
        </div>
      )}
    </PageTransition>
  );
}
