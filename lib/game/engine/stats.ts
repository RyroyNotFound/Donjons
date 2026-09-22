import { getSubclass } from "@/lib/game/content/classes";
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
