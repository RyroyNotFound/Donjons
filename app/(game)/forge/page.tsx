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
import type { Item, ItemSlot, ResourceKind } from "@/types/game";

const RESOURCE_LABEL: Record<ResourceKind, string> = {
  wood: "Bois",
  ore: "Minerai",
  essence: "Essence",
};

const TIERS = [1, 2, 3];
type Filter = "all" | "free" | ItemSlot;

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
  const [filter, setFilter] = useState<Filter>("all");

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

  const reforge = (item: Item) =>
    run(`reforge-${item.id}`, async () => {
      const res = await callApi<{ item: Item }>(`/api/items/${item.id}/reforge`);
      return `Réforgé : ${res.item.name}.`;
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

        {TIERS.map((tier) => (
          <section key={tier} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-slate-50">Palier {tier}</h2>
              <p className="text-xs text-slate-500">{rarityOdds(tier)}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {RECIPES.filter((r) => r.tier === tier).map((recipe) => (
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
        ))}

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
                    <ItemCard item={item} equippedByName={heroName(item.equippedByHeroId)}>
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
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full"
                            disabled={busy !== null || !canAfford(reforgeInfo.gold, {}, reforgeInfo.shards)}
                            onClick={() => reforge(item)}
                          >
                            Réforger les affixes ({reforgeInfo.gold} or, {reforgeInfo.shards} éclats)
                          </Button>
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
