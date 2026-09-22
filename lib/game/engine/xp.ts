const ABSOLUTE_MAX_LEVEL = 60;

/** XP required to go from `level` to `level + 1`. */
export function xpToNextLevel(level: number): number {
  return Math.round(50 * Math.pow(level, 1.5));
}

export interface LevelUpResult {
  level: number;
  xp: number;
  levelsGained: number;
}

/**
 * Applies gained XP to a level/xp pair, resolving as many level-ups as needed.
 * `maxLevel` (typically the hero's star-rank cap) stops progression early —
 * XP earned past the cap is simply held at 0 rather than lost mid-bar.
 */
export function applyXpGain(
  currentLevel: number,
  currentXp: number,
  xpGained: number,
  maxLevel: number = ABSOLUTE_MAX_LEVEL,
): LevelUpResult {
  const cap = Math.min(maxLevel, ABSOLUTE_MAX_LEVEL);
  let level = currentLevel;
  let xp = currentXp + xpGained;
  let levelsGained = 0;

  while (level < cap) {
    const required = xpToNextLevel(level);
    if (xp < required) break;
    xp -= required;
    level += 1;
    levelsGained += 1;
  }

  if (level >= cap) xp = 0;

  return { level, xp, levelsGained };
}
