import type { ClassDefinition } from "@/types/game";

// Two to four classes per role. Add more later by pushing another ClassDefinition
// with the same `role` — nothing else needs to change, the hero/combat
// systems are role-agnostic. Talent trees live in lib/game/content/talents.ts,
// spells in lib/game/content/spells.ts — both keyed by classId.
export const CLASSES: ClassDefinition[] = [
  {
    id: "guerrier",
    role: "DPS",
    name: "Guerrier",
    description: "Combattant au corps-à-corps misant sur les dégâts bruts.",
    strengths: "Dégâts élevés, montée en puissance rapide.",
    weaknesses: "Peu de survie face aux dégâts de zone.",
    baseStats: { hp: 80, atkPhys: 16, atkMag: 2, defPhys: 6, defMag: 3, spd: 10, crit: 5, critDmg: 50 },
    statGrowthPerLevel: { hp: 8, atkPhys: 2.2, atkMag: 0.2, defPhys: 0.6, defMag: 0.3, spd: 0.3 },
  },
  {
    id: "archer",
    role: "DPS",
    name: "Archer",
    description: "Tireur agile qui frappe vite et de loin.",
    strengths: "Grande vitesse d'attaque, très mobile.",
    weaknesses: "Très fragile, meurt vite si submergé.",
    baseStats: { hp: 60, atkPhys: 14, atkMag: 1, defPhys: 3, defMag: 2, spd: 16, crit: 10, critDmg: 50 },
    statGrowthPerLevel: { hp: 5, atkPhys: 2, atkMag: 0.1, defPhys: 0.3, defMag: 0.2, spd: 0.6, crit: 0.15, critDmg: 0.3 },
  },
  {
    id: "mage",
    role: "DPS",
    name: "Mage",
    description: "Lanceur de sorts qui manie le feu, la glace et la foudre à distance.",
    strengths: "Gros dégâts magiques, exploite les faiblesses élémentaires.",
    weaknesses: "Le plus fragile de tous, aucune armure physique.",
    baseStats: { hp: 55, atkPhys: 1, atkMag: 17, defPhys: 2, defMag: 6, spd: 11, crit: 5, critDmg: 60 },
    statGrowthPerLevel: { hp: 4.5, atkMag: 2.3, defPhys: 0.2, defMag: 0.5, spd: 0.35 },
  },
  {
    id: "assassin",
    role: "DPS",
    name: "Assassin",
    description: "Lame de l'ombre qui mise tout sur les coups critiques.",
    strengths: "Taux et dégâts critiques très élevés, très rapide.",
    weaknesses: "Dégâts irréguliers, peu de défenses.",
    baseStats: { hp: 65, atkPhys: 13, atkMag: 3, defPhys: 4, defMag: 3, spd: 15, crit: 15, critDmg: 80 },
    statGrowthPerLevel: { hp: 5, atkPhys: 1.8, atkMag: 0.2, defPhys: 0.3, defMag: 0.3, spd: 0.5, crit: 0.25, critDmg: 0.5 },
  },
  {
    id: "pretre",
    role: "HEAL",
    name: "Prêtre",
    description: "Soigneur misant sur les soins directs et la résistance.",
    strengths: "Soins puissants, bonne survie.",
    weaknesses: "Dégâts infligés très faibles.",
    baseStats: { hp: 70, atkPhys: 1, atkMag: 8, defPhys: 4, defMag: 8, spd: 9, crit: 5, critDmg: 50 },
    statGrowthPerLevel: { hp: 7, atkPhys: 0.1, atkMag: 1, defPhys: 0.4, defMag: 0.8, spd: 0.3 },
  },
  {
    id: "druide",
    role: "HEAL",
    name: "Druide",
    description: "Soigneur de la nature, plus robuste mais moins puissant en soins.",
    strengths: "Très résistant pour un soigneur, bon en solo.",
    weaknesses: "Soins plus faibles que le Prêtre.",
    baseStats: { hp: 85, atkPhys: 1, atkMag: 6, defPhys: 6, defMag: 7, spd: 8, crit: 5, critDmg: 50 },
    statGrowthPerLevel: { hp: 9, atkPhys: 0.1, atkMag: 0.6, defPhys: 0.6, defMag: 0.7, spd: 0.25 },
  },
  {
    id: "paladin",
    role: "TANK",
    name: "Paladin",
    description: "Protecteur en armure lourde, encaisse pour son groupe.",
    strengths: "Très résistant, absorbe les dégâts.",
    weaknesses: "Dégâts infligés limités.",
    baseStats: { hp: 120, atkPhys: 8, atkMag: 3, defPhys: 12, defMag: 6, spd: 7, crit: 5, critDmg: 50 },
    statGrowthPerLevel: { hp: 12, atkPhys: 0.7, atkMag: 0.3, defPhys: 1.3, defMag: 0.6, spd: 0.2 },
  },
  {
    id: "colosse",
    role: "TANK",
    name: "Colosse",
    description: "Brute massive qui compte sur un réservoir de vie énorme plutôt que sur l'armure.",
    strengths: "Réservoir de vie énorme, frappe plus fort qu'un tank classique.",
    weaknesses: "Moins bonne mitigation, encaisse plus de dégâts bruts par coup.",
    baseStats: { hp: 150, atkPhys: 12, atkMag: 0, defPhys: 9, defMag: 2, spd: 6, crit: 5, critDmg: 60 },
    statGrowthPerLevel: { hp: 16, atkPhys: 1.2, atkMag: 0, defPhys: 1, defMag: 0.2, spd: 0.15 },
  },
];

export function getClass(id: string): ClassDefinition {
  const classDef = CLASSES.find((c) => c.id === id);
  if (!classDef) throw new Error(`Classe inconnue: ${id}`);
  return classDef;
}

export function tryGetClass(id: string | undefined): ClassDefinition | undefined {
  return id ? CLASSES.find((c) => c.id === id) : undefined;
}

export function getClassesByRole(role: string): ClassDefinition[] {
  return CLASSES.filter((c) => c.role === role);
}
