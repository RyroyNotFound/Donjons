import { createRng, randomInt } from "@/lib/game/engine/rng";
import type {
  HeroStats,
  ItemRarity,
  ItemSlot,
  ResourceKind,
  ZoneDefinition,
} from "@/types/game";

const ITEM_SLOTS: ItemSlot[] = ["weapon", "armor", "trinket"];
const ITEM_NAMES: Record<ItemSlot, string[]> = {
  weapon: ["Lame trouvée", "Dague rouillée", "Bâton noueux"],
  armor: ["Veste rapiécée", "Plastron cabossé", "Cape usée"],
  trinket: ["Anneau terni", "Breloque ternie", "Talisman fissuré"],
};
const RARITY_MULTIPLIER: Record<ItemRarity, number> = {
  commun: 1,
  rare: 1.6,
  epique: 2.4,
};

export interface DroppedItem {
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  statBonus: Partial<HeroStats>;
}

export interface ExpeditionLootResult {
  gold: number;
  resources: Partial<Record<ResourceKind, number>>;
  item?: DroppedItem;
  monsterCaptured?: string;
}

function rollDroppedItem(
  rng: () => number,
  zoneDifficulty: number,
): DroppedItem {
  const slot = ITEM_SLOTS[randomInt(rng, 0, ITEM_SLOTS.length - 1)];
  const rarityRoll = rng();
  const rarity: ItemRarity =
    rarityRoll < 0.08 ? "epique" : rarityRoll < 0.32 ? "rare" : "commun";
  const power = Math.round(
    (2 + zoneDifficulty / 15) * RARITY_MULTIPLIER[rarity],
  );

  const statKeys: (keyof HeroStats)[] = ["atk", "def", "hp", "spd"];
  const primaryStat = statKeys[randomInt(rng, 0, statKeys.length - 1)];
  const statBonus: Partial<HeroStats> = {
    [primaryStat]: primaryStat === "hp" ? power * 3 : power,
  };

  const names = ITEM_NAMES[slot];
  const name = names[randomInt(rng, 0, names.length - 1)];

  return { name, slot, rarity, statBonus };
}

/** Rolls the loot for a completed expedition. Seeded so a claim can be re-verified deterministically. */
export function rollExpeditionLoot(
  zone: ZoneDefinition,
  teamPower: number,
  seed: string,
): ExpeditionLootResult {
  const rng = createRng(seed);
  const powerFactor = Math.min(1.3, Math.max(0.5, teamPower / zone.difficulty));

  const gold = Math.round(
    randomInt(rng, zone.loot.goldMin, zone.loot.goldMax) * powerFactor,
  );

  const resources: Partial<Record<ResourceKind, number>> = {};
  for (const [kind, range] of Object.entries(zone.loot.resourceDrops)) {
    if (!range) continue;
    const [min, max] = range;
    resources[kind as ResourceKind] = Math.round(
      randomInt(rng, min, max) * powerFactor,
    );
  }

  const item =
    rng() < zone.loot.itemDropChance
      ? rollDroppedItem(rng, zone.difficulty)
      : undefined;

  let monsterCaptured: string | undefined;
  if (zone.loot.monsterCaptureChance && zone.loot.monsterCaptureRefId) {
    if (rng() < zone.loot.monsterCaptureChance) {
      monsterCaptured = zone.loot.monsterCaptureRefId;
    }
  }

  return { gold, resources, item, monsterCaptured };
}
