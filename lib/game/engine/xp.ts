const MAX_LEVEL = 50;

/** XP required to go from `level` to `level + 1`. */
export function xpToNextLevel(level: number): number {
  return Math.round(50 * Math.pow(level, 1.5));
}

export interface LevelUpResult {
  level: number;
  xp: number;
  levelsGained: number;
}

/** Applies gained XP to a level/xp pair, resolving as many level-ups as needed. */
export function applyXpGain(
  currentLevel: number,
  currentXp: number,
  xpGained: number,
): LevelUpResult {
  let level = currentLevel;
  let xp = currentXp + xpGained;
  let levelsGained = 0;

  while (level < MAX_LEVEL) {
    const required = xpToNextLevel(level);
    if (xp < required) break;
    xp -= required;
    level += 1;
    levelsGained += 1;
  }

  if (level >= MAX_LEVEL) xp = 0;

  return { level, xp, levelsGained };
}
