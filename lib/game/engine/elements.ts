// Client-safe stat-key helpers plus the crit/element rules shared by the arena (lib/game/arena/engine.ts)
// and raid combat (lib/game/engine/dungeonCombat.ts), so both modes compute crits and elemental
// damage the same way.

import type { Element, HeroStats } from "@/types/game";

export const ELEMENTS: Element[] = ["feu", "glace", "foudre", "sacre", "ombre"];

export const ELEMENT_LABEL: Record<Element, string> = {
  feu: "Feu",
  glace: "Glace",
  foudre: "Foudre",
  sacre: "Sacré",
  ombre: "Ombre",
};

export const ELEMENT_ICON: Record<Element, string> = {
  feu: "🔥",
  glace: "❄️",
  foudre: "⚡",
  sacre: "✨",
  ombre: "🌑",
};

export const ELEMENT_COLOR: Record<Element, string> = {
  feu: "#fb923c",
  glace: "#7dd3fc",
  foudre: "#fde047",
  sacre: "#fef3c7",
  ombre: "#a78bfa",
};

/** The HeroStats key holding the resistance to each element. */
export const RES_KEY: Record<Element, keyof HeroStats> = {
  feu: "resFeu",
  glace: "resGlace",
  foudre: "resFoudre",
  sacre: "resSacre",
  ombre: "resOmbre",
};

/** Stats that are flat amounts (scaled by star rank, rarity...), as opposed to percentages. */
export const FLAT_STAT_KEYS: (keyof HeroStats)[] = ["hp", "atkPhys", "atkMag", "defPhys", "defMag", "spd"];
/** Stats expressed in % (crit chance, crit damage, resistances). */
export const PERCENT_STAT_KEYS: (keyof HeroStats)[] = ["crit", "critDmg", ...ELEMENTS.map((e) => RES_KEY[e]), "trapRes"];
export const STAT_KEYS: (keyof HeroStats)[] = [...FLAT_STAT_KEYS, ...PERCENT_STAT_KEYS];

export function isPercentStat(stat: keyof HeroStats): boolean {
  return PERCENT_STAT_KEYS.includes(stat);
}

/** Every hero's baseline before class/gear: 5% crit chance, crits deal x1.5. */
export const BASE_CRIT = 5;
export const BASE_CRIT_DMG = 50;

/** A full HeroStats from a partial one (missing keys = 0). */
export function fullStats(partial: Partial<HeroStats>): HeroStats {
  const stats = {} as HeroStats;
  for (const key of STAT_KEYS) stats[key] = partial[key] ?? 0;
  return stats;
}

export const MAX_CRIT_CHANCE = 75;
/** Cap on a hero's own trap resistance (the party's "disarm" aura stacks on top, multiplicatively). */
export const MAX_TRAP_RESISTANCE = 75;
export const MAX_RESISTANCE = 75;
/** Weaknesses bottom out at double damage. */
export const MIN_RESISTANCE = -100;

/** 0..0.75 crit probability from a crit stat in %. */
export function critChance(crit: number | undefined): number {
  return Math.min(MAX_CRIT_CHANCE, Math.max(0, crit ?? 0)) / 100;
}

/** Damage multiplier of a critical hit from a critDmg stat in %. */
export function critMultiplier(critDmg: number | undefined): number {
  return 1 + Math.max(0, critDmg ?? 0) / 100;
}

/** Damage multiplier for a hit of `element` against a target with `resistance` % to it. */
export function elementalMultiplier(element: Element | undefined, resistance: number | undefined): number {
  if (!element) return 1;
  const res = Math.min(MAX_RESISTANCE, Math.max(MIN_RESISTANCE, resistance ?? 0));
  return 1 - res / 100;
}

/** The element -> resistance map of a stat block (only non-zero entries). */
export function resistancesOf(stats: Partial<HeroStats>): Partial<Record<Element, number>> {
  const res: Partial<Record<Element, number>> = {};
  for (const element of ELEMENTS) {
    const value = stats[RES_KEY[element]];
    if (value) res[element] = value;
  }
  return res;
}
