import { getSubclass } from "@/lib/game/content/classes";
import { starRankStatMultiplier } from "@/lib/game/economy";
import type { Hero, HeroStats, Item } from "@/types/game";

function addStats(a: HeroStats, b: Partial<HeroStats>): HeroStats {
  return {
    hp: a.hp + (b.hp ?? 0),
    atk: a.atk + (b.atk ?? 0),
    def: a.def + (b.def ?? 0),
    spd: a.spd + (b.spd ?? 0),
  };
}

/** Computes a hero's effective combat stats from base class, level, talents and equipped items. */
export function resolveHeroStats(hero: Hero, equippedItems: Item[]): HeroStats {
  const subclass = getSubclass(hero.subclassId);
  const levelsAboveOne = Math.max(0, hero.level - 1);

  let stats: HeroStats = {
    hp: subclass.baseStats.hp + subclass.statGrowthPerLevel.hp * levelsAboveOne,
    atk:
      subclass.baseStats.atk + subclass.statGrowthPerLevel.atk * levelsAboveOne,
    def:
      subclass.baseStats.def + subclass.statGrowthPerLevel.def * levelsAboveOne,
    spd:
      subclass.baseStats.spd + subclass.statGrowthPerLevel.spd * levelsAboveOne,
  };

  for (const node of subclass.talentTree) {
    const rank = hero.talents[node.id] ?? 0;
    if (rank <= 0) continue;
    stats = addStats(stats, {
      hp: (node.statBonusPerRank.hp ?? 0) * rank,
      atk: (node.statBonusPerRank.atk ?? 0) * rank,
      def: (node.statBonusPerRank.def ?? 0) * rank,
      spd: (node.statBonusPerRank.spd ?? 0) * rank,
    });
  }

  const starMultiplier = starRankStatMultiplier(hero.starRank ?? 1);
  stats = {
    hp: stats.hp * starMultiplier,
    atk: stats.atk * starMultiplier,
    def: stats.def * starMultiplier,
    spd: stats.spd * starMultiplier,
  };

  for (const item of equippedItems) {
    stats = addStats(stats, item.statBonus);
  }

  return {
    hp: Math.round(stats.hp),
    atk: Math.round(stats.atk),
    def: Math.round(stats.def),
    spd: Math.round(stats.spd),
  };
}

/** Total talent points a hero should have earned by their current level (1 per level above 1). */
export function totalTalentPointsForLevel(level: number): number {
  return Math.max(0, level - 1);
}

/** Aggregates a party of heroes into the single avatar the arena mini-game controls: HP and ATK add up (more heroes = tankier and harder-hitting), SPD averages (movement/attack pace). */
export function compositePartyStats(statsList: HeroStats[]): HeroStats {
  if (statsList.length === 0) return { hp: 1, atk: 1, def: 0, spd: 0 };

  const totals = statsList.reduce(
    (acc, s) => ({
      hp: acc.hp + s.hp,
      atk: acc.atk + s.atk,
      def: acc.def + s.def,
      spd: acc.spd + s.spd,
    }),
    { hp: 0, atk: 0, def: 0, spd: 0 },
  );

  return {
    hp: totals.hp,
    atk: totals.atk,
    def: Math.round(totals.def / statsList.length),
    spd: Math.round(totals.spd / statsList.length),
  };
}
