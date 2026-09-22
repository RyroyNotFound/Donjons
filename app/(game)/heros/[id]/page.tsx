"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { getSubclass } from "@/lib/game/content/classes";
import { resolveHeroStats } from "@/lib/game/engine/stats";
import { xpToNextLevel } from "@/lib/game/engine/xp";
import { MAX_STAR_RANK, levelCapForStar, starUpCost } from "@/lib/game/economy";
import { callApi } from "@/lib/api/client";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
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

  const hero = heroes.find((h) => h.id === id);
  if (!hero) {
    return <p className="text-zinc-400">Héros introuvable.</p>;
  }

  const subclass = getSubclass(hero.subclassId);
  const equippedItems = SLOTS.map((slot) =>
    hero.equipment[slot] ? items.find((i) => i.id === hero.equipment[slot]) : undefined,
  ).filter(Boolean) as Item[];
  const stats = resolveHeroStats(hero, equippedItems);
  const ownedUnequippedBySlot = (slot: ItemSlot) =>
    items.filter((i) => i.slot === slot && (!i.equippedByHeroId || i.equippedByHeroId === hero.id));

  async function spendTalent(nodeId: string) {
    setError(null);
    setBusy(true);
    try {
      await callApi(`/api/heroes/${hero!.id}/talents`, { nodeId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function equip(slot: ItemSlot, itemId: string | null) {
    setError(null);
    setBusy(true);
    try {
      await callApi(`/api/heroes/${hero!.id}/equip`, { slot, itemId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function ascend() {
    setError(null);
    setBusy(true);
    try {
      await callApi(`/api/heroes/${hero!.id}/ascend`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">{hero.name}</h1>
        <p className="text-zinc-400">
          {subclass.name} · {hero.role} · Niveau {hero.level}/{levelCapForStar(hero.starRank ?? 1)}
        </p>
        <p className="text-amber-400">
          {"★".repeat(hero.starRank ?? 1)}
          {"☆".repeat(MAX_STAR_RANK - (hero.starRank ?? 1))}
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-zinc-50">Statistiques</h2>
          <div className="mb-3">
            <p className="mb-1 text-xs text-zinc-500">
              XP {hero.xp}/{xpToNextLevel(hero.level)}
            </p>
            <ProgressBar value={hero.xp} max={xpToNextLevel(hero.level)} />
          </div>
          <ul className="space-y-1 text-sm text-zinc-300">
            <li>PV : {stats.hp}</li>
            <li>Attaque : {stats.atk}</li>
            <li>Défense : {stats.def}</li>
            <li>Vitesse : {stats.spd}</li>
          </ul>
          <p className="mt-3 text-xs text-zinc-500">
            Forces : {subclass.strengths} — Faiblesses : {subclass.weaknesses}
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-zinc-50">Équipement</h2>
          <div className="space-y-3">
            {SLOTS.map((slot) => {
              const currentId = hero.equipment[slot];
              const options = ownedUnequippedBySlot(slot);
              return (
                <div key={slot}>
                  <label className="mb-1 block text-xs text-zinc-500">{SLOT_LABEL[slot]}</label>
                  <select
                    disabled={busy}
                    value={currentId ?? ""}
                    onChange={(e) => equip(slot, e.target.value || null)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100"
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

      <Card>
        <h2 className="mb-3 font-semibold text-zinc-50">Ascension</h2>
        {(hero.starRank ?? 1) >= MAX_STAR_RANK ? (
          <p className="text-sm text-zinc-400">Rang maximum atteint.</p>
        ) : (
          (() => {
            const cost = starUpCost(hero.starRank ?? 1);
            const availableShards = profile?.shards?.[hero.subclassId] ?? 0;
            const canAscend =
              !busy && availableShards >= cost.shards && (profile?.gold ?? 0) >= cost.gold;
            return (
              <div className="flex items-center justify-between text-sm">
                <p className="text-zinc-400">
                  Coût : {cost.shards} éclat{cost.shards > 1 ? "s" : ""} de {subclass.name} (
                  {availableShards} dispo) + {cost.gold} or
                </p>
                <button
                  onClick={ascend}
                  disabled={!canAscend}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Monter en étoile
                </button>
              </div>
            );
          })()
        )}
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold text-zinc-50">Arbre de talents</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Points disponibles : <span className="text-amber-400">{hero.talentPoints}</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {subclass.talentTree.map((node) => {
            const rank = hero.talents[node.id] ?? 0;
            const maxed = rank >= node.maxRank;
            const prereqOk = !node.requires || (hero.talents[node.requires] ?? 0) > 0;
            const starOk = !node.requiresStarRank || (hero.starRank ?? 1) >= node.requiresStarRank;
            const canAfford = hero.talentPoints >= node.cost;
            const canSpend = !maxed && prereqOk && starOk && canAfford && !busy;

            return (
              <div key={node.id} className="rounded-lg border border-zinc-800 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-zinc-100">{node.name}</p>
                  <span className="text-xs text-zinc-500">
                    {rank}/{node.maxRank}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">{node.description}</p>
                {node.requires && !prereqOk && (
                  <p className="mt-1 text-xs text-red-400">Prérequis manquant</p>
                )}
                {!starOk && (
                  <p className="mt-1 text-xs text-red-400">Nécessite {node.requiresStarRank}★</p>
                )}
                <button
                  onClick={() => spendTalent(node.id)}
                  disabled={!canSpend}
                  className="mt-2 w-full rounded-lg bg-amber-500 px-2 py-1 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {maxed ? "Maîtrisé" : `Améliorer (${node.cost} pt)`}
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
