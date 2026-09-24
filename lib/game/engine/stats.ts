import { tryGetClass } from "@/lib/game/content/classes";
import { getTalentsForClass } from "@/lib/game/content/talents";
import { tryGetSpell } from "@/lib/game/content/spells";
import { getMastery } from "@/lib/game/content/masteries";
import { starRankStatMultiplier, componentRankMultiplier } from "@/lib/game/economy";
import { itemTotalStats } from "@/lib/game/engine/items";
import {
  BASE_CRIT,
  BASE_CRIT_DMG,
  critChance,
  critMultiplier,
  FLAT_STAT_KEYS,
  fullStats,
  PERCENT_STAT_KEYS,
  STAT_KEYS,
} from "@/lib/game/engine/elements";
import type { Element, Hero, HeroStats, Item, RaidEffectTag, Role } from "@/types/game";

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

/** The element a hero fights with: that of its first equipped spell carrying one. Undefined = neutral. */
export function heroElement(hero: Pick<Hero, "equippedSpellIds">): Element | undefined {
  for (const spellId of hero.equippedSpellIds ?? []) {
    const element = tryGetSpell(spellId)?.element;
    if (element) return element;
  }
  return undefined;
}

/** Stats a classless hero has before any customization — deliberately weak, to make assigning a class the obvious first move. */
const CLASSLESS_BASE_STATS: HeroStats = fullStats({
  hp: 10,
  atkPhys: 1,
  atkMag: 1,
  defPhys: 1,
  defMag: 1,
  spd: 5,
  crit: BASE_CRIT,
  critDmg: BASE_CRIT_DMG,
});

function addStats(a: HeroStats, b: Partial<HeroStats>, multiplier = 1): HeroStats {
  const sum = { ...a };
  for (const key of STAT_KEYS) sum[key] += (b[key] ?? 0) * multiplier;
  return sum;
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
    stats = addStats(fullStats(classDef.baseStats), classDef.statGrowthPerLevel, levelsAboveOne);

    for (const node of getTalentsForClass(hero.classId!)) {
      const rank = hero.talents[node.id] ?? 0;
      if (rank <= 0) continue;
      stats = addStats(stats, node.statBonusPerRank, rank * rankMul(node.id));
    }

    // Star rank scales flat stats only — a % stat (crit, resistances) would snowball.
    const starMultiplier = starRankStatMultiplier(hero.starRank ?? 1);
    for (const key of FLAT_STAT_KEYS) stats[key] *= starMultiplier;
  } else {
    stats = { ...CLASSLESS_BASE_STATS };
  }

  // Spells are pure combat actions (raid + arena effect tags, element) — no passive stat bonus.

  for (const masteryId of hero.equippedMasteryIds ?? []) {
    stats = addStats(stats, getMastery(masteryId).statBonus, rankMul(masteryId));
  }

  for (const item of equippedItems) {
    stats = addStats(stats, itemTotalStats(item));
  }

  const resolved = {} as HeroStats;
  for (const key of STAT_KEYS) resolved[key] = Math.round(stats[key]);
  resolved.hp = Math.max(1, resolved.hp);
  for (const key of ["atkPhys", "atkMag", "defPhys", "defMag", "spd", "crit", "critDmg"] as const) {
    resolved[key] = Math.max(0, resolved[key]);
  }
  return resolved;
}

/** Total talent points a hero should have earned by their current level (1 per level above 1). */
export function totalTalentPointsForLevel(level: number): number {
  return Math.max(0, level - 1);
}

/** The Item documents a hero currently has equipped, looked up in the owner's item list. */
export function equippedItemsOf(hero: Hero, items: Item[]): Item[] {
  return Object.values(hero.equipment)
    .filter(Boolean)
    .map((id) => items.find((i) => i.id === id))
    .filter((item): item is Item => Boolean(item));
}

/** Single "power" number for a hero's resolved stats — compared against ZoneDefinition.recommendedPower.
 *  Crits count through the expected damage they add; resistances count lightly (they only help
 *  against the matching element). */
export function heroPower(stats: HeroStats): number {
  const bestAtk = Math.max(stats.atkPhys, stats.atkMag);
  const critBonus = bestAtk * critChance(stats.crit) * (critMultiplier(stats.critDmg) - 1);
  const resTotal = PERCENT_STAT_KEYS.filter((k) => k.startsWith("res")).reduce((sum, k) => sum + Math.max(0, stats[k] ?? 0), 0);
  return Math.round(
    stats.atkPhys + stats.atkMag + stats.defPhys + stats.defMag + stats.hp / 10 + stats.spd + critBonus + resTotal / 5,
  );
}
