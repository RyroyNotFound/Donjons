import type { HeroStats, ItemSlot } from "@/types/game";

export interface AffixDefinition {
  id: string;
  /** Appended to the item's name when it's the item's first affix ("Épée en fer du Colosse"). */
  suffix: string;
  /** Tier-1 roll range per stat. Negative ranges are trade-off maluses (like masteries' bonus/malus pairs).
   *  Scaled up by the item's tier (see TIER_AFFIX_SCALE in lib/game/engine/items.ts) — % stats
   *  (crit, resistances) scale at half that rate. */
  statRanges: Partial<Record<keyof HeroStats, [number, number]>>;
  /** Slots this affix can roll on. Undefined = any slot. */
  slots?: ItemSlot[];
}

// Add an affix by pushing an entry here — crafting, loot and reforging all draw from this pool.
export const AFFIXES: AffixDefinition[] = [
  { id: "affix-tranchant", suffix: "de l'Acier", statRanges: { atkPhys: [2, 4] } },
  { id: "affix-arcanique", suffix: "des Arcanes", statRanges: { atkMag: [2, 4] } },
  { id: "affix-colosse", suffix: "du Colosse", statRanges: { hp: [8, 16] } },
  { id: "affix-rempart", suffix: "du Rempart", statRanges: { defPhys: [2, 3] }, slots: ["armor", "trinket"] },
  { id: "affix-voile", suffix: "du Voile", statRanges: { defMag: [2, 3] }, slots: ["armor", "trinket"] },
  { id: "affix-vif", suffix: "du Vif-argent", statRanges: { spd: [1, 2] } },
  {
    id: "affix-berserker",
    suffix: "du Berserker",
    statRanges: { atkPhys: [4, 6], defPhys: [-2, -1] },
    slots: ["weapon", "trinket"],
  },
  {
    id: "affix-tempete",
    suffix: "de la Tempête",
    statRanges: { atkMag: [4, 6], defMag: [-2, -1] },
    slots: ["weapon", "trinket"],
  },
  { id: "affix-sentinelle", suffix: "de la Sentinelle", statRanges: { defPhys: [1, 2], defMag: [1, 2] } },
  { id: "affix-duelliste", suffix: "du Duelliste", statRanges: { atkPhys: [1, 3], spd: [1, 1] } },
  { id: "affix-mystique", suffix: "du Mystique", statRanges: { atkMag: [1, 3], defMag: [1, 2] } },
  {
    id: "affix-tortue",
    suffix: "de la Tortue",
    statRanges: { hp: [14, 22], spd: [-2, -1] },
    slots: ["armor"],
  },
  { id: "affix-vampire", suffix: "du Vampire", statRanges: { atkPhys: [1, 2], atkMag: [1, 2], hp: [4, 8] } },
  // --- Critiques ---
  { id: "affix-precision", suffix: "de Précision", statRanges: { crit: [2, 4] } },
  { id: "affix-bourreau", suffix: "du Bourreau", statRanges: { critDmg: [8, 15] }, slots: ["weapon", "trinket"] },
  {
    id: "affix-fauve",
    suffix: "du Fauve",
    statRanges: { crit: [3, 5], critDmg: [5, 10], hp: [-8, -4] },
    slots: ["weapon"],
  },
  // --- Résistances élémentaires ---
  { id: "affix-braise", suffix: "de la Braise", statRanges: { resFeu: [6, 12] }, slots: ["armor", "trinket"] },
  { id: "affix-givre", suffix: "du Givre", statRanges: { resGlace: [6, 12] }, slots: ["armor", "trinket"] },
  { id: "affix-orage", suffix: "de l'Orage", statRanges: { resFoudre: [6, 12] }, slots: ["armor", "trinket"] },
  { id: "affix-aube", suffix: "de l'Aube", statRanges: { resSacre: [6, 12] }, slots: ["armor", "trinket"] },
  { id: "affix-crepuscule", suffix: "du Crépuscule", statRanges: { resOmbre: [6, 12] }, slots: ["armor", "trinket"] },
  { id: "affix-demineur", suffix: "du Démineur", statRanges: { trapRes: [5, 10] }, slots: ["armor", "trinket"] },
  { id: "affix-rodeur", suffix: "du Rôdeur", statRanges: { trapRes: [3, 6], spd: [1, 1] }, slots: ["trinket"] },
  {
    id: "affix-arc-en-ciel",
    suffix: "de l'Arc-en-ciel",
    statRanges: { resFeu: [2, 4], resGlace: [2, 4], resFoudre: [2, 4], resSacre: [2, 4], resOmbre: [2, 4] },
    slots: ["trinket"],
  },
];

export function getAffix(id: string): AffixDefinition | undefined {
  return AFFIXES.find((a) => a.id === id);
}

export function affixesForSlot(slot: ItemSlot): AffixDefinition[] {
  return AFFIXES.filter((a) => !a.slots || a.slots.includes(slot));
}
