import { randomInt } from "@/lib/game/engine/rng";
import { MONSTERS } from "@/lib/game/content/dungeon";
import {
  COMMON_SUBCLASSES,
  PITY_EPIQUE_THRESHOLD,
  PITY_LEGENDAIRE_THRESHOLD,
  PITY_RARE_THRESHOLD,
  RARE_SUBCLASSES,
  RARITY_WEIGHTS,
} from "@/lib/game/content/gacha";
import type { GachaPityState, GachaPullResult, GachaRarity } from "@/types/game";

export const HERO_NAME_POOL = [
  "Kael", "Mira", "Thane", "Yssa", "Roran", "Sable",
  "Idris", "Wren", "Corvin", "Liora", "Dorn", "Ashka",
  "Fenn", "Nyra", "Talan", "Brienne",
];

const SHARD_AMOUNT: Record<GachaRarity, number> = { commun: 2, rare: 4, epique: 8, legendaire: 15 };
const GOLD_RANGE: Record<GachaRarity, [number, number]> = {
  commun: [20, 50],
  rare: [60, 120],
  epique: [100, 200],
  legendaire: [250, 400],
};

function rollRarity(rng: () => number, pity: GachaPityState): GachaRarity {
  if (pity.pullsSinceLegendaire + 1 >= PITY_LEGENDAIRE_THRESHOLD) return "legendaire";
  if (pity.pullsSinceEpique + 1 >= PITY_EPIQUE_THRESHOLD) return "epique";
  if (pity.pullsSinceRare + 1 >= PITY_RARE_THRESHOLD) return "rare";

  const roll = rng();
  let cumulative = 0;
  for (const rarity of ["commun", "rare", "epique", "legendaire"] as GachaRarity[]) {
    cumulative += RARITY_WEIGHTS[rarity];
    if (roll < cumulative) return rarity;
  }
  return "commun";
}

function updatePity(pity: GachaPityState, rarity: GachaRarity): GachaPityState {
  const next: GachaPityState = {
    totalPulls: pity.totalPulls + 1,
    pullsSinceRare: pity.pullsSinceRare + 1,
    pullsSinceEpique: pity.pullsSinceEpique + 1,
    pullsSinceLegendaire: pity.pullsSinceLegendaire + 1,
  };
  if (rarity === "rare" || rarity === "epique" || rarity === "legendaire") next.pullsSinceRare = 0;
  if (rarity === "epique" || rarity === "legendaire") next.pullsSinceEpique = 0;
  if (rarity === "legendaire") next.pullsSinceLegendaire = 0;
  return next;
}

function pickSubclass(rarity: GachaRarity, rng: () => number): string {
  const pool = rarity === "commun" ? COMMON_SUBCLASSES : RARE_SUBCLASSES;
  return pool[randomInt(rng, 0, pool.length - 1)];
}

interface RewardContext {
  ownedSubclassIds: string[];
  rosterFull: boolean;
}

function rollReward(rarity: GachaRarity, rng: () => number, ctx: RewardContext): GachaPullResult {
  function heroOrShards(): GachaPullResult {
    const subclassId = pickSubclass(rarity, rng);
    if (!ctx.ownedSubclassIds.includes(subclassId) && !ctx.rosterFull) {
      return { rarity, kind: "hero", subclassId };
    }
    return { rarity, kind: "shards", subclassId, amount: SHARD_AMOUNT[rarity] };
  }

  if (rarity === "legendaire") return heroOrShards();

  if (rarity === "epique") {
    if (rng() < 0.5) {
      const monster = MONSTERS[randomInt(rng, 0, MONSTERS.length - 1)];
      return { rarity, kind: "monsterFragment", monsterRefId: monster.id };
    }
    return heroOrShards();
  }

  if (rarity === "rare") {
    if (rng() < 0.3) {
      const [min, max] = GOLD_RANGE.rare;
      return { rarity, kind: "gold", amount: randomInt(rng, min, max) };
    }
    return heroOrShards();
  }

  // commun
  if (rng() < 0.6) {
    const [min, max] = GOLD_RANGE.commun;
    return { rarity, kind: "gold", amount: randomInt(rng, min, max) };
  }
  return heroOrShards();
}

export interface PerformPullsResult {
  results: GachaPullResult[];
  pity: GachaPityState;
}

/** Rolls `count` pulls in sequence, carrying pity and roster/ownership state across them. */
export function performPulls(
  rng: () => number,
  count: number,
  initialPity: GachaPityState,
  initialOwnedSubclassIds: string[],
  currentHeroCount: number,
  maxHeroes: number,
): PerformPullsResult {
  let pity = { ...initialPity };
  const owned = new Set(initialOwnedSubclassIds);
  let heroCount = currentHeroCount;
  const results: GachaPullResult[] = [];

  for (let i = 0; i < count; i++) {
    const rarity = rollRarity(rng, pity);
    pity = updatePity(pity, rarity);
    const reward = rollReward(rarity, rng, {
      ownedSubclassIds: [...owned],
      rosterFull: heroCount >= maxHeroes,
    });

    if (reward.kind === "hero" && reward.subclassId) {
      owned.add(reward.subclassId);
      heroCount++;
      reward.heroName = HERO_NAME_POOL[randomInt(rng, 0, HERO_NAME_POOL.length - 1)];
    }

    results.push(reward);
  }

  return { results, pity };
}
