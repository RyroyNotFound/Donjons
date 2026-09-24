import type { RecipeDefinition } from "@/types/game";

// Single profession to start ("Forgeron"). Add more professions later by
// giving recipes a different `profession` value — the crafting screen groups
// by profession automatically. `tier` sets the rarity odds and affix strength
// of what gets crafted (see lib/game/engine/items.ts CRAFT_RARITY_WEIGHTS);
// `result.statBonus` is the base at "commun", scaled up by the rolled rarity.
export const RECIPES: RecipeDefinition[] = [
  // --- Palier 1 ---
  {
    id: "epee-en-fer",
    name: "Épée en fer",
    profession: "Forgeron",
    description: "Une arme simple mais fiable.",
    durationSec: 60 * 2,
    tier: 1,
    cost: { gold: 30, resources: { ore: 6 } },
    result: { name: "Épée en fer", slot: "weapon", statBonus: { atkPhys: 4 } },
  },
  {
    id: "baton-de-frene",
    name: "Bâton de frêne",
    profession: "Forgeron",
    description: "Un bâton souple qui canalise la magie.",
    durationSec: 60 * 2,
    tier: 1,
    cost: { gold: 30, resources: { wood: 6 } },
    result: { name: "Bâton de frêne", slot: "weapon", statBonus: { atkMag: 4 } },
  },
  {
    id: "armure-de-cuir-cloutee",
    name: "Armure de cuir cloutée",
    profession: "Forgeron",
    description: "Protection légère renforcée de clous.",
    durationSec: 60 * 3,
    tier: 1,
    cost: { gold: 40, resources: { wood: 4, ore: 4 } },
    result: { name: "Armure de cuir cloutée", slot: "armor", statBonus: { defPhys: 3, hp: 10 } },
  },
  {
    id: "anneau-de-cuivre",
    name: "Anneau de cuivre",
    profession: "Forgeron",
    description: "Un anneau modeste, porte-bonheur des recrues.",
    durationSec: 60 * 2,
    tier: 1,
    cost: { gold: 35, resources: { ore: 3, wood: 2 } },
    result: { name: "Anneau de cuivre", slot: "trinket", statBonus: { spd: 1, hp: 8 } },
  },
  // --- Palier 2 ---
  {
    id: "hache-d-acier",
    name: "Hache d'acier",
    profession: "Forgeron",
    description: "Lourde et tranchante, elle fend boucliers et armures.",
    durationSec: 60 * 5,
    tier: 2,
    cost: { gold: 90, resources: { ore: 14, wood: 6 } },
    result: { name: "Hache d'acier", slot: "weapon", statBonus: { atkPhys: 8 } },
  },
  {
    id: "grimoire-relie",
    name: "Grimoire relié",
    profession: "Forgeron",
    description: "Recueil de formules griffonnées à l'encre d'essence.",
    durationSec: 60 * 5,
    tier: 2,
    cost: { gold: 90, resources: { wood: 10, essence: 4 } },
    result: { name: "Grimoire relié", slot: "weapon", statBonus: { atkMag: 8 } },
  },
  {
    id: "cotte-de-mailles",
    name: "Cotte de mailles",
    profession: "Forgeron",
    description: "Des milliers d'anneaux d'acier entrelacés.",
    durationSec: 60 * 6,
    tier: 2,
    cost: { gold: 100, resources: { ore: 16 } },
    result: { name: "Cotte de mailles", slot: "armor", statBonus: { defPhys: 6, hp: 20 } },
  },
  {
    id: "robe-runique",
    name: "Robe runique",
    profession: "Forgeron",
    description: "Tissu brodé de runes qui dévient les sorts.",
    durationSec: 60 * 6,
    tier: 2,
    cost: { gold: 100, resources: { wood: 8, essence: 5 } },
    result: { name: "Robe runique", slot: "armor", statBonus: { defMag: 6, hp: 16 } },
  },
  {
    id: "amulette-d-essence",
    name: "Amulette d'essence",
    profession: "Forgeron",
    description: "Amulette imprégnée d'essence magique.",
    durationSec: 60 * 6,
    tier: 2,
    cost: { gold: 80, resources: { essence: 5, ore: 2 } },
    result: { name: "Amulette d'essence", slot: "trinket", statBonus: { atkMag: 2, defMag: 2, spd: 2 } },
  },
  // --- Palier 3 ---
  {
    id: "lame-runique",
    name: "Lame runique",
    profession: "Forgeron",
    description: "Acier gravé de runes : frappe aussi bien le corps que l'esprit.",
    durationSec: 60 * 10,
    tier: 3,
    cost: { gold: 220, resources: { ore: 22, essence: 10 } },
    result: { name: "Lame runique", slot: "weapon", statBonus: { atkPhys: 9, atkMag: 5 } },
  },
  {
    id: "harnois-du-bastion",
    name: "Harnois du Bastion",
    profession: "Forgeron",
    description: "Armure de plates complète, forgée pour tenir une brèche.",
    durationSec: 60 * 10,
    tier: 3,
    cost: { gold: 240, resources: { ore: 24, wood: 10, essence: 6 } },
    result: { name: "Harnois du Bastion", slot: "armor", statBonus: { defPhys: 8, defMag: 5, hp: 35 } },
  },
  {
    id: "talisman-astral",
    name: "Talisman astral",
    profession: "Forgeron",
    description: "Un éclat d'étoile serti d'argent.",
    durationSec: 60 * 10,
    tier: 3,
    cost: { gold: 200, resources: { essence: 16, ore: 6 } },
    result: { name: "Talisman astral", slot: "trinket", statBonus: { atkMag: 4, atkPhys: 4, spd: 3 } },
  },
];

export function getRecipe(id: string): RecipeDefinition {
  const recipe = RECIPES.find((r) => r.id === id);
  if (!recipe) throw new Error(`Recette inconnue: ${id}`);
  return recipe;
}
