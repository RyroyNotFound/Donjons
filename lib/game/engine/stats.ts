import { tryGetClass } from "@/lib/game/content/classes";
import { getTalentsForClass } from "@/lib/game/content/talents";
import { tryGetSpell } from "@/lib/game/content/spells";
import { getMastery } from "@/lib/game/content/masteries";
import { starRankStatMultiplier, componentRankMultiplier } from "@/lib/game/economy";
import type { Hero, HeroStats, Item, RaidEffectTag, Role } from "@/types/game";

/** A hero's combat role, derived from its currently-assigned class. Undefined for a classless hero. */
export function getHeroRole(hero: Hero): Role | undefined {
  return tryGetClass(hero.classId)?.role;
}

/** The raid effect a hero fights with: the first equipped spell's raidEffectTag, if any are equipped —
 *  plus whether that spell's classId matches the hero's active class (a stronger effect, see
 *  RAID_MAGNITUDE in lib/game/engine/dungeonCombat.ts). Spells work regardless of class match. */
export function primaryRaidEffect(hero: Hero): { tag: RaidEffectTag; bonus: boolean } | undefined {
  for (const spellId of hero.equippedSpellIds ?? []) {
    const spell = tryGetSpell(spellId);
    if (spell) return { tag: spell.raidEffectTag, bonus: !!spell.classId && spell.classId === hero.classId };
  }
  return undefined;
}

/** Stats a classless hero has before any customization — deliberately weak, to make assigning a class the obvious first move. */
const CLASSLESS_BASE_STATS: HeroStats = { hp: 10, atkPhys: 1, atkMag: 1, defPhys: 1, defMag: 1, spd: 5 };

function addStats(a: HeroStats, b: Partial<HeroStats>): HeroStats {
  return {
    hp: a.hp + (b.hp ?? 0),
    atkPhys: a.atkPhys + (b.atkPhys ?? 0),
    atkMag: a.atkMag + (b.atkMag ?? 0),
    defPhys: a.defPhys + (b.defPhys ?? 0),
    defMag: a.defMag + (b.defMag ?? 0),
    spd: a.spd + (b.spd ?? 0),
  };
}

function scaledBonus(bonus: Partial<HeroStats>, multiplier: number): Partial<HeroStats> {
  return {
    hp: bonus.hp !== undefined ? bonus.hp * multiplier : undefined,
    atkPhys: bonus.atkPhys !== undefined ? bonus.atkPhys * multiplier : undefined,
    atkMag: bonus.atkMag !== undefined ? bonus.atkMag * multiplier : undefined,
    defPhys: bonus.defPhys !== undefined ? bonus.defPhys * multiplier : undefined,
    defMag: bonus.defMag !== undefined ? bonus.defMag * multiplier : undefined,
    spd: bonus.spd !== undefined ? bonus.spd * multiplier : undefined,
  };
}

/** Computes a hero's effective combat stats from class, level, talents, equipped spells/masteries and items.
 *  `componentRanks` (owner's account-wide spell/talent/mastery ranks, from gacha duplicates) scales each
 *  bonus by componentRankMultiplier — absent entries default to rank 1 (no bonus/malus scaling).
 *  Tolerant of a classless hero (returns a weak baseline + any equipped masteries) so it can still be displayed. */
export function resolveHeroStats(
  hero: Hero,
  equippedItems: Item[],
  componentRanks: Record<string, number> = {},
): HeroStats {
  const classDef = tryGetClass(hero.classId);
  let stats: HeroStats;

  const rankMul = (id: string) => componentRankMultiplier(componentRanks[id] ?? 1);

  if (classDef) {
    const levelsAboveOne = Math.max(0, hero.level - 1);
    stats = {
      hp: classDef.baseStats.hp + classDef.statGrowthPerLevel.hp * levelsAboveOne,
      atkPhys: classDef.baseStats.atkPhys + classDef.statGrowthPerLevel.atkPhys * levelsAboveOne,
      atkMag: classDef.baseStats.atkMag + classDef.statGrowthPerLevel.atkMag * levelsAboveOne,
      defPhys: classDef.baseStats.defPhys + classDef.statGrowthPerLevel.defPhys * levelsAboveOne,
      defMag: classDef.baseStats.defMag + classDef.statGrowthPerLevel.defMag * levelsAboveOne,
      spd: classDef.baseStats.spd + classDef.statGrowthPerLevel.spd * levelsAboveOne,
    };

    for (const node of getTalentsForClass(hero.classId!)) {
      const rank = hero.talents[node.id] ?? 0;
      if (rank <= 0) continue;
      const perRank = scaledBonus(node.statBonusPerRank, rankMul(node.id));
      stats = addStats(stats, {
        hp: (perRank.hp ?? 0) * rank,
        atkPhys: (perRank.atkPhys ?? 0) * rank,
        atkMag: (perRank.atkMag ?? 0) * rank,
        defPhys: (perRank.defPhys ?? 0) * rank,
        defMag: (perRank.defMag ?? 0) * rank,
        spd: (perRank.spd ?? 0) * rank,
      });
    }

    const starMultiplier = starRankStatMultiplier(hero.starRank ?? 1);
    stats = {
      hp: stats.hp * starMultiplier,
      atkPhys: stats.atkPhys * starMultiplier,
      atkMag: stats.atkMag * starMultiplier,
      defPhys: stats.defPhys * starMultiplier,
      defMag: stats.defMag * starMultiplier,
      spd: stats.spd * starMultiplier,
    };
  } else {
    stats = { ...CLASSLESS_BASE_STATS };
  }

  // Spells are pure combat actions (raid + arena effect tags) — no passive stat bonus.

  for (const masteryId of hero.equippedMasteryIds ?? []) {
    stats = addStats(stats, scaledBonus(getMastery(masteryId).statBonus, rankMul(masteryId)));
  }

  for (const item of equippedItems) {
    stats = addStats(stats, item.statBonus);
  }

  return {
    hp: Math.max(1, Math.round(stats.hp)),
    atkPhys: Math.max(0, Math.round(stats.atkPhys)),
    atkMag: Math.max(0, Math.round(stats.atkMag)),
    defPhys: Math.max(0, Math.round(stats.defPhys)),
    defMag: Math.max(0, Math.round(stats.defMag)),
    spd: Math.max(0, Math.round(stats.spd)),
  };
}

/** Total talent points a hero should have earned by their current level (1 per level above 1). */
export function totalTalentPointsForLevel(level: number): number {
  return Math.max(0, level - 1);
}

/** Aggregates a party of heroes into the single avatar the arena mini-game controls: HP and ATK add up (more heroes = tankier and harder-hitting), SPD averages (movement/attack pace). */
export function compositePartyStats(statsList: HeroStats[]): HeroStats {
  if (statsList.length === 0) return { hp: 1, atkPhys: 1, atkMag: 0, defPhys: 0, defMag: 0, spd: 0 };

  const totals = statsList.reduce(
    (acc, s) => ({
      hp: acc.hp + s.hp,
      atkPhys: acc.atkPhys + s.atkPhys,
      atkMag: acc.atkMag + s.atkMag,
      defPhys: acc.defPhys + s.defPhys,
      defMag: acc.defMag + s.defMag,
      spd: acc.spd + s.spd,
    }),
    { hp: 0, atkPhys: 0, atkMag: 0, defPhys: 0, defMag: 0, spd: 0 },
  );

  return {
    hp: totals.hp,
    atkPhys: totals.atkPhys,
    atkMag: totals.atkMag,
    defPhys: Math.round(totals.defPhys / statsList.length),
    defMag: Math.round(totals.defMag / statsList.length),
    spd: Math.round(totals.spd / statsList.length),
  };
}
