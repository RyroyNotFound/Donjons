"use client";

import { useState } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { RECIPES } from "@/lib/game/content/recipes";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { RARITY_BADGE } from "@/lib/ui/rarity";
import { PageTransition } from "@/components/PageTransition";
import type { ResourceKind } from "@/types/game";

const RESOURCE_LABEL: Record<ResourceKind, string> = {
  wood: "Bois",
  ore: "Minerai",
  essence: "Essence",
};

export default function ForgePage() {
  const { profile, items } = useGameData();
  const [crafting, setCrafting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const unequippedItems = items.filter((i) => !i.equippedByHeroId);

  function canAfford(recipeId: string): boolean {
    if (!profile) return false;
    const recipe = RECIPES.find((r) => r.id === recipeId)!;
    if (profile.gold < recipe.cost.gold) return false;
    return Object.entries(recipe.cost.resources).every(
      ([kind, amount]) => (profile.resources[kind as ResourceKind] ?? 0) >= (amount ?? 0),
    );
  }

  async function craft(recipeId: string) {
    setError(null);
    setMessage(null);
    setCrafting(recipeId);
    try {
      await callApi("/api/crafting/craft", { recipeId });
      setMessage("Objet fabriqué avec succès !");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCrafting(null);
    }
  }

  return (
    <PageTransition>
    <div className="space-y-6">
      <PageHeader title="Forge" subtitle="Fabriquez de l'équipement à partir de vos ressources." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RECIPES.map((recipe) => (
          <Card key={recipe.id}>
            <p className="font-display font-semibold text-slate-50">{recipe.name}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500">{recipe.profession}</p>
            <p className="mt-1 text-sm text-slate-400">{recipe.description}</p>
            <p className="mt-2 text-xs text-slate-500">
              Coût : {recipe.cost.gold} or
              {Object.entries(recipe.cost.resources).map(
                ([kind, amount]) => `, ${amount} ${RESOURCE_LABEL[kind as ResourceKind]}`,
              )}
            </p>
            <Button
              onClick={() => craft(recipe.id)}
              disabled={crafting !== null || !canAfford(recipe.id)}
              className="mt-3 w-full"
            >
              {crafting === recipe.id ? "Fabrication..." : "Fabriquer"}
            </Button>
          </Card>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}

      <Card>
        <h2 className="font-display mb-3 font-semibold text-slate-50">Inventaire (non équipé)</h2>
        {unequippedItems.length === 0 && (
          <p className="text-sm text-slate-500">Aucun objet en réserve.</p>
        )}
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {unequippedItems.map((item) => (
            <li
              key={item.id}
              className={`rounded-lg border px-3 py-2 text-sm ${RARITY_BADGE[item.rarity]}`}
            >
              <p className="text-slate-100">{item.name}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span>{item.slot}</span>
                <Badge tone={item.rarity}>{item.rarity}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
    </PageTransition>
  );
}
