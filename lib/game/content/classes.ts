import type { SubclassDefinition } from "@/types/game";

// One subclass per role to start. Add more subclasses later by pushing
// another SubclassDefinition with the same `role` — nothing else needs to
// change, the hero/talent/combat systems are role-agnostic.
export const SUBCLASSES: SubclassDefinition[] = [
  {
    id: "guerrier",
    role: "DPS",
    name: "Guerrier",
    description: "Combattant au corps-à-corps misant sur les dégâts bruts.",
    strengths: "Dégâts élevés, montée en puissance rapide.",
    weaknesses: "Peu de survie face aux dégâts de zone.",
    baseStats: { hp: 80, atk: 16, def: 6, spd: 10 },
    statGrowthPerLevel: { hp: 8, atk: 2.2, def: 0.6, spd: 0.3 },
    talentTree: [
      {
        id: "guerrier-force-brute",
        name: "Force brute",
        description: "+ dégâts d'attaque par rang.",
        tier: 1,
        cost: 1,
        maxRank: 3,
        statBonusPerRank: { atk: 1.5 },
      },
      {
        id: "guerrier-cuir-durci",
        name: "Cuir durci",
        description: "+ défense par rang.",
        tier: 1,
        cost: 1,
        maxRank: 3,
        statBonusPerRank: { def: 1 },
      },
      {
        id: "guerrier-fureur",
        name: "Fureur",
        description: "+ vitesse par rang, nécessite Force brute.",
        tier: 2,
        cost: 2,
        maxRank: 2,
        requires: "guerrier-force-brute",
        statBonusPerRank: { spd: 1, atk: 1 },
      },
      {
        id: "guerrier-acharnement",
        name: "Acharnement",
        description: "+ dégâts et + vie par rang, ultime.",
        tier: 3,
        cost: 3,
        maxRank: 1,
        requires: "guerrier-fureur",
        statBonusPerRank: { atk: 4, hp: 10 },
      },
    ],
  },
  {
    id: "pretre",
    role: "HEAL",
    name: "Prêtre",
    description: "Soigneur misant sur les soins directs et la résistance.",
    strengths: "Soins puissants, bonne survie.",
    weaknesses: "Dégâts infligés très faibles.",
    baseStats: { hp: 70, atk: 6, def: 8, spd: 9 },
    statGrowthPerLevel: { hp: 7, atk: 0.5, def: 0.8, spd: 0.3 },
    talentTree: [
      {
        id: "pretre-lumiere-apaisante",
        name: "Lumière apaisante",
        description: "+ vie max par rang (soins plus efficaces en valeur).",
        tier: 1,
        cost: 1,
        maxRank: 3,
        statBonusPerRank: { hp: 6 },
      },
      {
        id: "pretre-devotion",
        name: "Dévotion",
        description: "+ défense par rang.",
        tier: 1,
        cost: 1,
        maxRank: 3,
        statBonusPerRank: { def: 1 },
      },
      {
        id: "pretre-zele",
        name: "Zèle",
        description: "+ vitesse par rang, nécessite Lumière apaisante.",
        tier: 2,
        cost: 2,
        maxRank: 2,
        requires: "pretre-lumiere-apaisante",
        statBonusPerRank: { spd: 1 },
      },
      {
        id: "pretre-sanctuaire",
        name: "Sanctuaire",
        description: "+ vie et + défense par rang, ultime.",
        tier: 3,
        cost: 3,
        maxRank: 1,
        requires: "pretre-zele",
        statBonusPerRank: { hp: 15, def: 3 },
      },
    ],
  },
  {
    id: "paladin",
    role: "TANK",
    name: "Paladin",
    description: "Protecteur en armure lourde, encaisse pour son groupe.",
    strengths: "Très résistant, absorbe les dégâts.",
    weaknesses: "Dégâts infligés limités.",
    baseStats: { hp: 120, atk: 9, def: 14, spd: 7 },
    statGrowthPerLevel: { hp: 12, atk: 0.8, def: 1.6, spd: 0.2 },
    talentTree: [
      {
        id: "paladin-rempart",
        name: "Rempart",
        description: "+ défense par rang.",
        tier: 1,
        cost: 1,
        maxRank: 3,
        statBonusPerRank: { def: 1.5 },
      },
      {
        id: "paladin-endurance",
        name: "Endurance",
        description: "+ vie par rang.",
        tier: 1,
        cost: 1,
        maxRank: 3,
        statBonusPerRank: { hp: 10 },
      },
      {
        id: "paladin-vigueur",
        name: "Vigueur",
        description: "+ dégâts par rang, nécessite Rempart.",
        tier: 2,
        cost: 2,
        maxRank: 2,
        requires: "paladin-rempart",
        statBonusPerRank: { atk: 1.5 },
      },
      {
        id: "paladin-bastion",
        name: "Bastion",
        description: "+ vie et + défense par rang, ultime.",
        tier: 3,
        cost: 3,
        maxRank: 1,
        requires: "paladin-vigueur",
        statBonusPerRank: { hp: 20, def: 4 },
      },
    ],
  },
];

export function getSubclass(id: string): SubclassDefinition {
  const subclass = SUBCLASSES.find((s) => s.id === id);
  if (!subclass) throw new Error(`Sous-classe inconnue: ${id}`);
  return subclass;
}

export function getSubclassesByRole(role: string): SubclassDefinition[] {
  return SUBCLASSES.filter((s) => s.role === role);
}
