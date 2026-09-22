import type { RecipeDefinition } from "@/types/game";

// Single profession to start ("Forgeron"). Add more professions later by
// giving recipes a different `profession` value — the crafting screen groups
// by profession automatically.
export const RECIPES: RecipeDefinition[] = [
  {
    id: "epee-en-fer",
    name: "Épée en fer",
    profession: "Forgeron",
    description: "Une arme simple mais fiable.",
    durationSec: 60 * 2,
    cost: { gold: 30, resources: { ore: 6 } },
    result: {
      name: "Épée en fer",
      slot: "weapon",
      rarity: "commun",
      statBonus: { atk: 4 },
    },
  },
  {
    id: "armure-de-cuir-cloutee",
    name: "Armure de cuir cloutée",
    profession: "Forgeron",
    description: "Protection légère renforcée de clous.",
    durationSec: 60 * 3,
    cost: { gold: 40, resources: { wood: 4, ore: 4 } },
    result: {
      name: "Armure de cuir cloutée",
      slot: "armor",
      rarity: "commun",
      statBonus: { def: 3, hp: 10 },
    },
  },
  {
    id: "amulette-d-essence",
    name: "Amulette d'essence",
    profession: "Forgeron",
    description: "Amulette imprégnée d'essence magique.",
    durationSec: 60 * 6,
    cost: { gold: 80, resources: { essence: 5, ore: 2 } },
    result: {
      name: "Amulette d'essence",
      slot: "trinket",
      rarity: "rare",
      statBonus: { atk: 2, def: 2, spd: 2 },
    },
  },
];

export function getRecipe(id: string): RecipeDefinition {
  const recipe = RECIPES.find((r) => r.id === id);
  if (!recipe) throw new Error(`Recette inconnue: ${id}`);
  return recipe;
}
