"use client";

import { useState } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { RECIPES } from "@/lib/game/content/recipes";
import { Card } from "@/components/Card";
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-50">Forge</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RECIPES.map((recipe) => (
          <Card key={recipe.id}>
            <p className="font-semibold text-zinc-50">{recipe.name}</p>
            <p className="text-xs text-zinc-500">{recipe.profession}</p>
            <p className="mt-1 text-sm text-zinc-400">{recipe.description}</p>
            <p className="mt-2 text-xs text-zinc-500">
              Coût : {recipe.cost.gold} or
              {Object.entries(recipe.cost.resources).map(
                ([kind, amount]) => `, ${amount} ${RESOURCE_LABEL[kind as ResourceKind]}`,
              )}
            </p>
            <button
              onClick={() => craft(recipe.id)}
              disabled={crafting !== null || !canAfford(recipe.id)}
              className="mt-3 w-full rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {crafting === recipe.id ? "Fabrication..." : "Fabriquer"}
            </button>
          </Card>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}

      <Card>
        <h2 className="mb-3 font-semibold text-zinc-50">Inventaire (non équipé)</h2>
        {unequippedItems.length === 0 && (
          <p className="text-sm text-zinc-500">Aucun objet en réserve.</p>
        )}
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {unequippedItems.map((item) => (
            <li key={item.id} className="rounded-lg border border-zinc-800 px-3 py-2 text-sm">
              <p className="text-zinc-100">{item.name}</p>
              <p className="text-xs text-zinc-500">
                {item.slot} · {item.rarity}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
