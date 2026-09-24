// Client-safe pricing formulas for dungeon upgrades (mirrors lib/game/economy.ts).

import { getUpgradeTrack } from "@/lib/game/content/dungeonUpgrades";
import type { DungeonUpgradeTrackId, ResourceKind } from "@/types/game";

const COST_GROWTH_PER_LEVEL = 1.35;

/** Cost to raise a dungeon upgrade track from `currentLevel` to `currentLevel + 1`. */
export function dungeonUpgradeCost(
  trackId: DungeonUpgradeTrackId,
  currentLevel: number,
): Partial<Record<ResourceKind, number>> {
  const track = getUpgradeTrack(trackId);
  const scale = Math.pow(COST_GROWTH_PER_LEVEL, currentLevel);
  const cost: Partial<Record<ResourceKind, number>> = {};
  for (const [kind, amount] of Object.entries(track.baseCost) as [ResourceKind, number][]) {
    cost[kind] = Math.round(amount * scale);
  }
  return cost;
}
