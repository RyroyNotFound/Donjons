import { fullStats } from "@/lib/game/engine/elements";
import type { MonsterDefinition, TrapDefinition } from "@/types/game";

// Fixed 5x5 board, orthogonal adjacency. A grid (rather than a free-form
// node graph) keeps placement, connectivity validation and raid fog-of-war
// all trivial: neighbors are just +/-1 row or column.
export const GRID_ROWS = 5;
export const GRID_COLS = 5;
// Middle of the left edge, so a layout can branch up, down and right.
export const ENTRANCE_CELL = { row: 2, col: 0 };

/** Most heroes one raid can send in — same as the biggest expedition party, and the team size
 *  the defense level (average of the defender's 4 best heroes) is measured against. */
export const RAID_PARTY_MAX = 4;

export const MIN_TREASURE_ROOMS = 1;
/** Monster stat multiplier from a dungeon's defense level (its owner's heroes' level): a level-40
 *  owner's orcs hit like level-40 monsters. Beast Mastery then multiplies on top. */
export function monsterScaleForDefenseLevel(defenseLevel: number | undefined): number {
  return 1 + 0.45 * Math.max(0, (defenseLevel ?? 1) - 1);
}
export const MAX_TREASURE_ROOMS = 4;
export const TREASURE_ROOM_COST = 4;

export const TRAPS: TrapDefinition[] = [
  {
    id: "fosse-a-pieux",
    name: "Fosse à pieux",
    description: "Inflige des dégâts à toute l'équipe adverse à l'entrée.",
    tier: 1,
    cost: 2,
    damagePercent: 0.1,
    baseCharges: 2,
  },
  {
    id: "gaz-toxique",
    name: "Gaz toxique",
    description: "Dégâts modérés à toute l'équipe adverse.",
    tier: 2,
    cost: 3,
    damagePercent: 0.16,
    baseCharges: 2,
  },
  {
    id: "runes-explosives",
    name: "Runes explosives",
    description: "Dégâts lourds à toute l'équipe adverse.",
    tier: 3,
    cost: 5,
    damagePercent: 0.24,
    baseCharges: 1,
    element: "feu",
  },
  {
    id: "pluie-de-givre",
    name: "Pluie de givre",
    description: "Des éclats de glace s'abattent sur l'équipe (dégâts de glace).",
    tier: 2,
    cost: 3,
    damagePercent: 0.14,
    baseCharges: 2,
    element: "glace",
  },
  {
    id: "arc-foudroyant",
    name: "Arc foudroyant",
    description: "Un éclair saute d'un héros à l'autre (dégâts de foudre).",
    tier: 2,
    cost: 3,
    damagePercent: 0.14,
    baseCharges: 2,
    element: "foudre",
  },
  {
    id: "glyphe-sacre",
    name: "Glyphe sacré",
    description: "Une lumière aveuglante brûle les intrus (dégâts sacrés).",
    tier: 3,
    cost: 4,
    damagePercent: 0.19,
    baseCharges: 1,
    element: "sacre",
  },
  {
    id: "voile-d-ombre",
    name: "Voile d'ombre",
    description: "Des ténèbres qui rongent la vie (dégâts d'ombre).",
    tier: 3,
    cost: 4,
    damagePercent: 0.19,
    baseCharges: 1,
    element: "ombre",
  },
];

/** Each extra trap stacked in the same room hits for this much less than the previous one — a room of
 *  4 traps is nasty, not an instant wipe. */
export const TRAP_STACK_FALLOFF = 0.8;

export const MONSTERS: MonsterDefinition[] = [
  {
    id: "gobelin-eclaireur",
    name: "Orc éclaireur",
    description: "Rapide en éclaireur, mais peu armé.",
    cost: 2,
    // Fast skirmisher: burns easily, slips through the shadows.
    stats: fullStats({ hp: 60, atkPhys: 10, defPhys: 3, defMag: 1, spd: 12, crit: 8, critDmg: 50, resFeu: -40, resFoudre: -15, resOmbre: 25 }),
  },
  {
    id: "golem-de-pierre",
    name: "Golem d'ossements",
    description: "Une armure de squelette animée par une magie noire, lente mais increvable.",
    cost: 4,
    // Undead: holy and fire burn it, shadow and frost barely scratch it.
    stats: fullStats({ hp: 140, atkPhys: 9, defPhys: 12, defMag: 6, spd: 4, critDmg: 50, resSacre: -40, resFeu: -20, resOmbre: 25, resGlace: 20 }),
  },
  {
    id: "araignee-venimeuse",
    name: "Orc chaman",
    description: "Manie la magie tribale en plus de son gourdin, bon équilibre attaque/vitesse.",
    cost: 3,
    // Storm shaman: hurls lightning, shrugs it off, dreads frost.
    stats: fullStats({ hp: 90, atkPhys: 9, atkMag: 6, defPhys: 5, defMag: 3, spd: 10, crit: 5, critDmg: 50, resFoudre: 25, resGlace: -40, resFeu: 10 }),
    element: "foudre",
  },
  {
    id: "squelette",
    name: "Squelette",
    description: "Un mort-vivant de base : faible seul, pénible en nombre.",
    cost: 1,
    // Cheap undead filler: holy shatters it, shadow and frost barely touch it.
    stats: fullStats({ hp: 45, atkPhys: 8, defPhys: 4, defMag: 4, spd: 8, critDmg: 50, resSacre: -50, resFeu: -10, resOmbre: 30, resGlace: 20 }),
  },
  {
    id: "orc-pillard",
    name: "Orc pillard",
    description: "Frappe vite et fort, cherche les failles — mais ne porte presque rien.",
    cost: 3,
    // Glass cannon: fast, crits often; any hit hurts it. Freezes badly.
    stats: fullStats({ hp: 55, atkPhys: 14, defPhys: 2, defMag: 2, spd: 16, crit: 25, critDmg: 70, resGlace: -30, resFeu: -20, resOmbre: 15 }),
  },
  {
    id: "orc-cuirasse",
    name: "Orc cuirassé",
    description: "Une montagne de fer : les coups physiques glissent dessus, la magie et la foudre le percent.",
    cost: 4,
    // Physical wall: huge defPhys, almost no defMag — a team that only hits physically stalls on it.
    stats: fullStats({ hp: 150, atkPhys: 11, defPhys: 15, defMag: 2, spd: 5, critDmg: 50, resFoudre: -40, resFeu: 10, resGlace: 10 }),
  },
  {
    id: "spectre-pourpre",
    name: "Spectre pourpre",
    description: "Un assassin mort-vivant qui frappe en magie d'ombre, fragile face aux sorts.",
    cost: 4,
    // Shadow caster: magical hits (defMag matters), sturdy vs physical, weak to holy.
    stats: fullStats({ hp: 70, atkPhys: 2, atkMag: 15, defPhys: 10, defMag: 2, spd: 13, crit: 15, critDmg: 60, resSacre: -40, resFeu: -15, resOmbre: 40 }),
    element: "ombre",
  },
  // --- Ondins: creatures of the flooded depths. Frost attacks, and water conducts lightning.
  {
    id: "ondin-eclaireur",
    name: "Ondin éclaireur",
    description: "Le plus commun des ondins : rapide, frappe au givre.",
    cost: 2,
    stats: fullStats({ hp: 65, atkPhys: 11, defPhys: 4, defMag: 4, spd: 13, crit: 8, critDmg: 50, resGlace: 25, resFoudre: -40, resFeu: 15 }),
    element: "glace",
  },
  {
    id: "ondin-harponneur",
    name: "Ondin harponneur",
    description: "Son harpon traverse les armures (perce-défense).",
    cost: 3,
    stats: fullStats({ hp: 70, atkPhys: 13, defPhys: 5, defMag: 3, spd: 11, crit: 10, critDmg: 60, resGlace: 25, resFoudre: -40 }),
    raidEffectTag: "pierce",
  },
  {
    id: "ondin-aquamancien",
    name: "Ondin aquamancien",
    description: "Mage des profondeurs : ses vagues de givre éclaboussent un second héros.",
    cost: 4,
    stats: fullStats({ hp: 70, atkMag: 15, defPhys: 3, defMag: 9, spd: 10, critDmg: 50, resGlace: 30, resFoudre: -40, resFeu: 10 }),
    element: "glace",
    raidEffectTag: "cleave",
  },
  {
    id: "ondin-mystique",
    name: "Ondin mystique",
    description: "Soigneur : chaque tour, il referme les plaies de l'ondin le plus blessé. À abattre en premier.",
    cost: 4,
    stats: fullStats({ hp: 80, atkMag: 10, defPhys: 4, defMag: 8, spd: 9, critDmg: 50, resGlace: 25, resFoudre: -40 }),
    element: "glace",
    role: "HEAL",
    raidEffectTag: "heal",
  },
  {
    id: "ondin-empaleur",
    name: "Ondin empaleur",
    description: "Tank : attire la plupart des coups et se protège avant d'embrocher.",
    cost: 4,
    stats: fullStats({ hp: 170, atkPhys: 10, defPhys: 14, defMag: 8, spd: 6, critDmg: 50, resGlace: 20, resFoudre: -40 }),
    role: "TANK",
    raidEffectTag: "shield",
  },
  // --- Elfes déchus: holy light turned cruel. They shrug off holy damage, shadow undoes them.
  {
    id: "elfe-archere",
    name: "Archère elfe",
    description: "Tireuse d'élite : ses flèches achèvent les héros affaiblis (exécution).",
    cost: 3,
    stats: fullStats({ hp: 60, atkPhys: 14, defPhys: 3, defMag: 5, spd: 15, crit: 20, critDmg: 60, resOmbre: -40, resSacre: 25 }),
    raidEffectTag: "execute",
  },
  {
    id: "elfe-enchanteresse",
    name: "Enchanteresse elfe",
    description: "Soigneuse de lumière : garde ses alliés debout tant qu'elle vit.",
    cost: 4,
    stats: fullStats({ hp: 75, atkMag: 12, defPhys: 3, defMag: 10, spd: 10, critDmg: 50, resOmbre: -40, resSacre: 30 }),
    element: "sacre",
    role: "HEAL",
    raidEffectTag: "heal",
  },
  {
    id: "elfe-lame-dansante",
    name: "Lame dansante elfe",
    description: "Virevolte et se régénère à chaque coup porté (vol de vie).",
    cost: 4,
    stats: fullStats({ hp: 85, atkPhys: 13, defPhys: 6, defMag: 6, spd: 17, crit: 15, critDmg: 60, resOmbre: -40, resSacre: 20 }),
    element: "sacre",
    raidEffectTag: "lifesteal",
  },
  // --- Halfelins.
  {
    id: "chapardeur-halfelin",
    name: "Chapardeur halfelin",
    description: "Petit, vif et insaisissable : se met à couvert avant chaque attaque (bouclier).",
    cost: 2,
    stats: fullStats({ hp: 50, atkPhys: 9, defPhys: 6, defMag: 6, spd: 18, crit: 20, critDmg: 50, resGlace: -30, resFeu: 10, resOmbre: 10 }),
    raidEffectTag: "shield",
  },
];

export const BOSSES: MonsterDefinition[] = [
  {
    id: "seigneur-des-ombres",
    name: "Liche des ombres",
    description: "Le nécromancien qui hante les profondeurs du donjon, gardien final.",
    cost: 8,
    isBoss: true,
    // Shadow lich: casts shadow, immune-ish to it, weak to holy and fire.
    stats: fullStats({ hp: 260, atkPhys: 8, atkMag: 16, defPhys: 8, defMag: 12, spd: 9, crit: 10, critDmg: 50, resOmbre: 35, resGlace: 15, resSacre: -40, resFeu: -20 }),
    element: "ombre",
  },
  {
    id: "seigneur-elfe",
    name: "Seigneur elfe",
    description: "Le souverain des elfes déchus : un tank sacré qui étourdit ceux qu'il frappe.",
    cost: 8,
    isBoss: true,
    // Holy warlord: draws the hits, stuns; shadow undoes him.
    stats: fullStats({ hp: 300, atkPhys: 17, defPhys: 14, defMag: 10, spd: 10, crit: 10, critDmg: 60, resSacre: 35, resGlace: 10, resOmbre: -40, resFoudre: -15 }),
    element: "sacre",
    role: "TANK",
    raidEffectTag: "stun",
  },
];

export function getTrap(id: string): TrapDefinition {
  const trap = TRAPS.find((t) => t.id === id);
  if (!trap) throw new Error(`Piège inconnu: ${id}`);
  return trap;
}

export function getMonster(id: string): MonsterDefinition {
  const monster =
    MONSTERS.find((m) => m.id === id) ?? BOSSES.find((m) => m.id === id);
  if (!monster) throw new Error(`Monstre inconnu: ${id}`);
  return monster;
}

export function trapTierUnlockedAtLevel(tier: 1 | 2 | 3): number {
  if (tier === 1) return 0;
  if (tier === 2) return 3;
  return 6;
}
