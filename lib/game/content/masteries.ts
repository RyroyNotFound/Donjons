import type { MasteryDefinition } from "@/types/game";

// Universal passive stat bonuses — unlike talents/spells, never class-locked.
// Owned via gacha (UserProfile.componentRanks) before they can be equipped
// into one of a hero's mastery slots; duplicates raise their rank instead of
// granting a second copy (lib/game/economy.ts componentRankMultiplier).
// Several are deliberate trade-offs (a malus alongside the bonus).
export const MASTERIES: MasteryDefinition[] = [
  // --- Offense physique ---
  { id: "mastery-tranchant", name: "Tranchant", description: "Aiguise les coups portés.", statBonus: { atkPhys: 3 } },
  {
    id: "mastery-brutalite",
    name: "Brutalité",
    description: "Frappe fort, encaisse mal.",
    statBonus: { atkPhys: 6, defPhys: -2 },
  },
  {
    id: "mastery-precision-mortelle",
    name: "Précision mortelle",
    description: "Chaque coup compte.",
    statBonus: { atkPhys: 3, spd: 1 },
  },
  {
    id: "mastery-rage",
    name: "Rage",
    description: "La colère décuple la force, au prix de la garde magique.",
    statBonus: { atkPhys: 5, defMag: -2 },
  },
  {
    id: "mastery-frappe-lourde",
    name: "Frappe lourde",
    description: "Une arme massive, difficile à manier vite.",
    statBonus: { atkPhys: 7, spd: -2 },
  },
  // --- Offense magique ---
  { id: "mastery-flux-arcanique", name: "Flux arcanique", description: "Canalise l'énergie brute.", statBonus: { atkMag: 3 } },
  {
    id: "mastery-surcharge",
    name: "Surcharge",
    description: "Puise dans ses réserves sans retenue.",
    statBonus: { atkMag: 6, defPhys: -2 },
  },
  {
    id: "mastery-focalisation",
    name: "Focalisation",
    description: "Un esprit clair, offensif et protégé.",
    statBonus: { atkMag: 3, defMag: 2 },
  },
  {
    id: "mastery-combustion-interieure",
    name: "Combustion intérieure",
    description: "Brûle sa propre vitalité pour frapper plus fort.",
    statBonus: { atkMag: 6, hp: -8 },
  },
  {
    id: "mastery-chant-occulte",
    name: "Chant occulte",
    description: "Un rituel qui accélère et renforce.",
    statBonus: { atkMag: 3, spd: 1 },
  },
  // --- Défense physique ---
  { id: "mastery-cuirasse", name: "Cuirasse", description: "Renforce l'armure.", statBonus: { defPhys: 3 } },
  {
    id: "mastery-peau-de-granit",
    name: "Peau de granit",
    description: "Une carapace lourde, qui ralentit.",
    statBonus: { defPhys: 6, spd: -2 },
  },
  { id: "mastery-parade", name: "Parade", description: "Une garde solide et vive.", statBonus: { defPhys: 3, hp: 6 } },
  {
    id: "mastery-rempart-vivant",
    name: "Rempart vivant",
    description: "Un mur infranchissable, mais totalement passif.",
    statBonus: { defPhys: 8, hp: 15, atkPhys: -3, atkMag: -3 },
  },
  // --- Défense magique ---
  { id: "mastery-voile-spirituel", name: "Voile spirituel", description: "Repousse les énergies hostiles.", statBonus: { defMag: 3 } },
  {
    id: "mastery-sceau-protecteur",
    name: "Sceau protecteur",
    description: "Une ward qui renforce corps et esprit.",
    statBonus: { defMag: 3, hp: 6 },
  },
  {
    id: "mastery-dissipation",
    name: "Dissipation",
    description: "Absorbe la magie ennemie au prix de la sienne.",
    statBonus: { defMag: 5, atkMag: -2 },
  },
  // --- Vie / vitesse ---
  { id: "mastery-vigueur", name: "Vigueur", description: "Renforce l'endurance.", statBonus: { hp: 12 } },
  { id: "mastery-robustesse", name: "Robustesse", description: "Un réservoir de vie conséquent.", statBonus: { hp: 20 } },
  { id: "mastery-vivacite", name: "Vivacité", description: "Allège les mouvements.", statBonus: { spd: 2 } },
  {
    id: "mastery-celerite",
    name: "Célérité",
    description: "Rapide comme l'éclair, à découvert.",
    statBonus: { spd: 4, defPhys: -2, defMag: -2 },
  },
  // --- Hybrides / défensifs équilibrés ---
  {
    id: "mastery-endurance",
    name: "Endurance",
    description: "Un corps robuste et bien protégé.",
    statBonus: { hp: 8, defPhys: 1.5 },
  },
  {
    id: "mastery-precision",
    name: "Précision",
    description: "Des frappes plus vives et plus rapides.",
    statBonus: { atkPhys: 2, spd: 1 },
  },
  {
    id: "mastery-polyvalence",
    name: "Polyvalence",
    description: "Un entraînement équilibré, sans spécialisation.",
    statBonus: { hp: 4, atkPhys: 1, defPhys: 1, spd: 0.5 },
  },
  {
    id: "mastery-sang-froid",
    name: "Sang-froid",
    description: "Une posture défensive totale, mais figée.",
    statBonus: { defPhys: 3, defMag: 3, spd: -2 },
  },
  {
    id: "mastery-instinct-de-survie",
    name: "Instinct de survie",
    description: "Fuir et encaisser plutôt que frapper.",
    statBonus: { hp: 10, spd: 2, atkPhys: -2, atkMag: -2 },
  },
  {
    id: "mastery-fureur-berserk",
    name: "Fureur berserk",
    description: "Tout à l'attaque, aucune retenue.",
    statBonus: { atkPhys: 8, defPhys: -3, defMag: -3 },
  },
  {
    id: "mastery-harmonie",
    name: "Harmonie",
    description: "Un peu de tout, sans faiblesse ni excès.",
    statBonus: { hp: 4, atkPhys: 1, atkMag: 1, defPhys: 1, defMag: 1, spd: 0.5 },
  },
  {
    id: "mastery-absorption",
    name: "Absorption",
    description: "Se replie derrière une garde magique solide.",
    statBonus: { hp: 8, defMag: 3, atkPhys: -2 },
  },
  {
    id: "mastery-domination",
    name: "Domination",
    description: "Frappe des deux mains, physique et magique, sans se ménager.",
    statBonus: { atkPhys: 3, atkMag: 3, hp: -8 },
  },
];

export function getMastery(id: string): MasteryDefinition {
  const mastery = MASTERIES.find((m) => m.id === id);
  if (!mastery) throw new Error(`Maîtrise inconnue: ${id}`);
  return mastery;
}
