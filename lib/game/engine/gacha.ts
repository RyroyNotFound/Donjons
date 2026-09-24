import { randomInt } from "@/lib/game/engine/rng";
import { MONSTERS } from "@/lib/game/content/dungeon";
import { CLASSES } from "@/lib/game/content/classes";
import { TALENTS } from "@/lib/game/content/talents";
import { SPELLS } from "@/lib/game/content/spells";
import { MASTERIES } from "@/lib/game/content/masteries";
import {
  FIRST_CLASS_GUARANTEE_PULL,
  PITY_EPIQUE_THRESHOLD,
  PITY_LEGENDAIRE_THRESHOLD,
  PITY_RARE_THRESHOLD,
  RARITY_WEIGHTS,
} from "@/lib/game/content/gacha";
import { MAX_COMPONENT_RANK } from "@/lib/game/economy";
import { MAXED_DUPLICATE_STARDUST_MULTIPLIER, STARDUST_PER_PULL } from "@/lib/game/content/observatory";
import type { GachaPityState, GachaPullResult, GachaRarity } from "@/types/game";

const ALL_CLASS_IDS = CLASSES.map((c) => c.id);
const ALL_TALENT_IDS = TALENTS.map((t) => t.id);
const ALL_SPELL_IDS = SPELLS.map((s) => s.id);
const ALL_MASTERY_IDS = MASTERIES.map((m) => m.id);

/** Fallback currency amount when a roll lands on a class already owned, or a spell/talent/mastery
 *  already at MAX_COMPONENT_RANK. */
const RANK_TOKEN_FALLBACK: Record<GachaRarity, number> = { commun: 2, rare: 4, epique: 8, legendaire: 15 };
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

interface RewardContext {
  unlockedClasses: string[];
  componentRanks: Record<string, number>;
}

/** Classes are a simple binary unlock (no rank system yet) — a duplicate falls back to rank tokens. */
function classOrTokens(rarity: GachaRarity, rng: () => number, unlockedClasses: string[]): GachaPullResult {
  const refId = ALL_CLASS_IDS[randomInt(rng, 0, ALL_CLASS_IDS.length - 1)];
  if (!unlockedClasses.includes(refId)) return { rarity, kind: "class", refId };
  return { rarity, kind: "rankToken", amount: RANK_TOKEN_FALLBACK[rarity] };
}

/** Picks a random id from `pool`; grants it (new unlock, or a rank-up if already owned) unless it's
 *  already at MAX_COMPONENT_RANK, in which case it falls back to rank tokens. */
function componentOrTokens(
  rarity: GachaRarity,
  kind: "spell" | "talent" | "mastery",
  pool: string[],
  ranks: Record<string, number>,
  rng: () => number,
): GachaPullResult {
  const refId = pool[randomInt(rng, 0, pool.length - 1)];
  const currentRank = ranks[refId] ?? 0;
  if (currentRank < MAX_COMPONENT_RANK) return { rarity, kind, refId };
  return { rarity, kind: "rankToken", amount: RANK_TOKEN_FALLBACK[rarity] };
}

function rollReward(rarity: GachaRarity, rng: () => number, ctx: RewardContext): GachaPullResult {
  if (rarity === "legendaire") {
    return classOrTokens(rarity, rng, ctx.unlockedClasses);
  }

  if (rarity === "epique") {
    if (rng() < 0.5) {
      const monster = MONSTERS[randomInt(rng, 0, MONSTERS.length - 1)];
      return { rarity, kind: "monsterFragment", monsterRefId: monster.id };
    }
    return componentOrTokens(rarity, "talent", ALL_TALENT_IDS, ctx.componentRanks, rng);
  }

  if (rarity === "rare") {
    if (rng() < 0.3) {
      const [min, max] = GOLD_RANGE.rare;
      return { rarity, kind: "gold", amount: randomInt(rng, min, max) };
    }
    return componentOrTokens(rarity, "spell", ALL_SPELL_IDS, ctx.componentRanks, rng);
  }

  // commun
  if (rng() < 0.6) {
    const [min, max] = GOLD_RANGE.commun;
    return { rarity, kind: "gold", amount: randomInt(rng, min, max) };
  }
  return componentOrTokens(rarity, "mastery", ALL_MASTERY_IDS, ctx.componentRanks, rng);
}

export interface PerformPullsResult {
  results: GachaPullResult[];
  pity: GachaPityState;
}

/** Rolls `count` pulls in sequence, carrying pity + ownership/rank state across them. */
export function performPulls(
  rng: () => number,
  count: number,
  initialPity: GachaPityState,
  initialUnlockedClasses: string[],
  initialComponentRanks: Record<string, number>,
): PerformPullsResult {
  let pity = { ...initialPity };
  const unlockedClasses = [...initialUnlockedClasses];
  const componentRanks = { ...initialComponentRanks };
  const results: GachaPullResult[] = [];

  for (let i = 0; i < count; i++) {
    const firstClassDue = unlockedClasses.length === 0 && pity.totalPulls + 1 >= FIRST_CLASS_GUARANTEE_PULL;
    const rarity = firstClassDue ? "legendaire" : rollRarity(rng, pity);
    pity = updatePity(pity, rarity);
    // With no class owned, a légendaire always lands on a (new) class — see classOrTokens.
    const reward = rollReward(rarity, rng, { unlockedClasses, componentRanks });
    // Every pull leaves stardust for the Observatoire; a maxed duplicate leaves more.
    reward.stardust =
      STARDUST_PER_PULL[rarity] * (reward.kind === "rankToken" ? 1 + MAXED_DUPLICATE_STARDUST_MULTIPLIER : 1);

    if (reward.refId) {
      if (reward.kind === "class") unlockedClasses.push(reward.refId);
      else componentRanks[reward.refId] = (componentRanks[reward.refId] ?? 0) + 1;
    }

    results.push(reward);
  }

  return { results, pity };
}
