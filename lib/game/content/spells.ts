import type { SpellDefinition } from "@/types/game";

// 5 attack spells per class (30 total). Every spell has TWO distinct combat
// effects — never a passive stat bonus: a raidEffectTag that modifies its
// owner's attack in turn-based dungeon-raid combat (lib/game/engine/dungeonCombat.ts),
// and an arenaAbilityTag that modifies its owner's contribution to the
// real-time arena mini-game (lib/game/arena/engine.ts). Owned via gacha
// (UserProfile.componentRanks) before they can be equipped; duplicates raise
// their rank instead of granting a second copy — rank currently only affects
// arena magnitude (per-count scaling already there); raid effects are flat.
export const SPELLS: SpellDefinition[] = [
  // --- Guerrier ---
  {
    id: "spell-frappe-de-zone",
    classId: "guerrier",
    name: "Frappe de zone",
    description: "Chaque coup touche aussi un ennemi proche en éclaboussure.",
    raidEffectTag: "cleave",
    arenaAbilityTag: "cleave",
  },
  {
    id: "spell-coup-fulgurant",
    classId: "guerrier",
    name: "Coup fulgurant",
    description: "Frappe avec une force redoublée les ennemis déjà affaiblis.",
    raidEffectTag: "execute",
    arenaAbilityTag: "dmgbuff",
  },
  {
    id: "spell-posture-offensive",
    classId: "guerrier",
    name: "Posture offensive",
    description: "Un assaut qui ignore une partie de la garde adverse.",
    raidEffectTag: "pierce",
    arenaAbilityTag: "dmgbuff",
  },
  {
    id: "spell-endurance-martiale",
    classId: "guerrier",
    name: "Endurance martiale",
    description: "Se protège juste avant de porter le coup.",
    raidEffectTag: "shield",
    arenaAbilityTag: "haste",
  },
  {
    id: "spell-cri-de-guerre",
    classId: "guerrier",
    name: "Cri de guerre",
    description: "Un cri percutant qui assomme la cible.",
    raidEffectTag: "stun",
    arenaAbilityTag: "cleave",
  },
  // --- Archer ---
  {
    id: "spell-tir-multiple",
    classId: "archer",
    name: "Tir multiple",
    description: "Décoche un projectile supplémentaire à chaque tir.",
    raidEffectTag: "cleave",
    arenaAbilityTag: "multishot",
  },
  {
    id: "spell-oeil-percant",
    classId: "archer",
    name: "Œil perçant",
    description: "Vise la moindre faiblesse pour achever les blessés.",
    raidEffectTag: "execute",
    arenaAbilityTag: "multishot",
  },
  {
    id: "spell-tir-a-bout-portant",
    classId: "archer",
    name: "Tir à bout portant",
    description: "Un tir qui traverse les défenses de plein fouet.",
    raidEffectTag: "pierce",
    arenaAbilityTag: "dmgbuff",
  },
  {
    id: "spell-retraite-agile",
    classId: "archer",
    name: "Retraite agile",
    description: "Recule juste après avoir tiré, hors de portée des ripostes.",
    raidEffectTag: "shield",
    arenaAbilityTag: "haste",
  },
  {
    id: "spell-volee-empoisonnee",
    classId: "archer",
    name: "Volée empoisonnée",
    description: "Chaque flèche empoisonne un peu plus la plaie.",
    raidEffectTag: "poison",
    arenaAbilityTag: "multishot",
  },
  // --- Prêtre ---
  {
    id: "spell-lumiere-curative",
    classId: "pretre",
    name: "Lumière curative",
    description: "Un soin renforcé sur l'allié le plus faible, au lieu d'attaquer.",
    raidEffectTag: "heal",
    arenaAbilityTag: "regen",
  },
  {
    id: "spell-benediction",
    classId: "pretre",
    name: "Bénédiction",
    description: "Un halo protecteur juste avant l'impact.",
    raidEffectTag: "shield",
    arenaAbilityTag: "dmgbuff",
  },
  {
    id: "spell-chatiment-sacre",
    classId: "pretre",
    name: "Châtiment sacré",
    description: "Une lumière implacable qui achève les affaiblis.",
    raidEffectTag: "execute",
    arenaAbilityTag: "dmgbuff",
  },
  {
    id: "spell-aura-apaisante",
    classId: "pretre",
    name: "Aura apaisante",
    description: "Un soin renforcé sur l'allié le plus faible, au lieu d'attaquer.",
    raidEffectTag: "heal",
    arenaAbilityTag: "regen",
  },
  {
    id: "spell-zele-devot",
    classId: "pretre",
    name: "Zèle dévot",
    description: "La ferveur étourdit la cible frappée.",
    raidEffectTag: "stun",
    arenaAbilityTag: "haste",
  },
  // --- Druide ---
  {
    id: "spell-instinct-sauvage",
    classId: "druide",
    name: "Instinct sauvage",
    description: "Griffe la cible principale et une proche en éclaboussure.",
    raidEffectTag: "cleave",
    arenaAbilityTag: "haste",
  },
  {
    id: "spell-griffe-naturelle",
    classId: "druide",
    name: "Griffe naturelle",
    description: "Une morsure qui infecte durablement la plaie.",
    raidEffectTag: "poison",
    arenaAbilityTag: "lifesteal",
  },
  {
    id: "spell-racines-epaisses",
    classId: "druide",
    name: "Racines épaisses",
    description: "Emprisonne la cible frappée dans les racines.",
    raidEffectTag: "stun",
    arenaAbilityTag: "haste",
  },
  {
    id: "spell-metamorphose-bestiale",
    classId: "druide",
    name: "Métamorphose bestiale",
    description: "La forme animale fond sur les proies affaiblies.",
    raidEffectTag: "execute",
    arenaAbilityTag: "dmgbuff",
  },
  {
    id: "spell-souffle-vital",
    classId: "druide",
    name: "Souffle vital",
    description: "Un soin renforcé sur l'allié le plus faible, au lieu d'attaquer.",
    raidEffectTag: "heal",
    arenaAbilityTag: "regen",
  },
  // --- Paladin ---
  {
    id: "spell-benediction-du-rempart",
    classId: "paladin",
    name: "Bénédiction du rempart",
    description: "Une garde solide qui absorbe le prochain coup reçu.",
    raidEffectTag: "shield",
    arenaAbilityTag: "dmgbuff",
  },
  {
    id: "spell-jugement",
    classId: "paladin",
    name: "Jugement",
    description: "Juge et châtie sans pitié les ennemis affaiblis.",
    raidEffectTag: "execute",
    arenaAbilityTag: "dmgbuff",
  },
  {
    id: "spell-bouclier-sacre",
    classId: "paladin",
    name: "Bouclier sacré",
    description: "Se protège avant l'assaut suivant.",
    raidEffectTag: "shield",
    arenaAbilityTag: "haste",
  },
  {
    id: "spell-charge-heroique",
    classId: "paladin",
    name: "Charge héroïque",
    description: "Fonce dans la mêlée, frappant large.",
    raidEffectTag: "cleave",
    arenaAbilityTag: "cleave",
  },
  {
    id: "spell-serment-inebranlable",
    classId: "paladin",
    name: "Serment inébranlable",
    description: "Une détermination qui impose le silence à la cible.",
    raidEffectTag: "stun",
    arenaAbilityTag: "haste",
  },
  // --- Colosse ---
  {
    id: "spell-morsure-vampirique",
    classId: "colosse",
    name: "Morsure vampirique",
    description: "Convertit une partie des dégâts infligés en vie.",
    raidEffectTag: "lifesteal",
    arenaAbilityTag: "lifesteal",
  },
  {
    id: "spell-ecrasement",
    classId: "colosse",
    name: "Écrasement",
    description: "Un coup massif qui écrase les défenses adverses.",
    raidEffectTag: "pierce",
    arenaAbilityTag: "dmgbuff",
  },
  {
    id: "spell-peau-de-fer",
    classId: "colosse",
    name: "Peau de fer",
    description: "Encaisse avant de rendre le coup.",
    raidEffectTag: "shield",
    arenaAbilityTag: "haste",
  },
  {
    id: "spell-fureur-titanesque",
    classId: "colosse",
    name: "Fureur titanesque",
    description: "La rage s'acharne sur les cibles les plus faibles.",
    raidEffectTag: "execute",
    arenaAbilityTag: "dmgbuff",
  },
  {
    id: "spell-poigne-implacable",
    classId: "colosse",
    name: "Poigne implacable",
    description: "Une prise brutale qui immobilise l'adversaire.",
    raidEffectTag: "stun",
    arenaAbilityTag: "cleave",
  },
];

export function getSpell(id: string): SpellDefinition {
  const spell = SPELLS.find((s) => s.id === id);
  if (!spell) throw new Error(`Sort inconnu: ${id}`);
  return spell;
}

export function tryGetSpell(id: string): SpellDefinition | undefined {
  return SPELLS.find((s) => s.id === id);
}

export function getSpellsForClass(classId: string | undefined): SpellDefinition[] {
  return SPELLS.filter((s) => !s.classId || s.classId === classId);
}
