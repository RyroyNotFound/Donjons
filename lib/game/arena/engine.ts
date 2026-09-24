import { createRng, randomInt } from "@/lib/game/engine/rng";
import { getMonster } from "@/lib/game/content/dungeon";
import { tryGetSpell } from "@/lib/game/content/spells";
import { tryGetClass } from "@/lib/game/content/classes";
import { componentRankMultiplier, SPELL_SLOTS } from "@/lib/game/economy";
import { heroElement } from "@/lib/game/engine/stats";
import {
  critChance,
  critMultiplier,
  ELEMENT_COLOR,
  elementalMultiplier,
  resistancesOf,
} from "@/lib/game/engine/elements";
import type { ArenaAbilityTag, ArenaRunResult, Element, HeroStats, Role, ZoneDefinition } from "@/types/game";

// Real-time expedition arena. Every hero of the party is on the field: the player steers the
// leader, the others follow in formation. Each hero auto-attacks according to its role and
// auto-casts each of its equipped spells (arenaAbilityTag) on cooldown — so a hero's whole build
// (class, level, stars, talents, masteries, items, spells + their ranks) is what makes the party
// strong here. Kills drop XP gems; each in-run level pauses on a choice of 3 upgrade cards.
// A zone boss spawns near the end; killing it ends the run early. Early zones also drop
// telegraphed hazards on the party (ZoneDefinition.hazard) so standing still isn't a strategy.
// Crits use each hero's own crit/critDmg stats (+ the run's crit cards); every hit a hero lands
// carries its elemental affinity (first equipped elemental spell) against the monster's
// resistances, and elemental monsters' hits are reduced by the heroes' resistances.

export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 500;
const HERO_RADIUS = 14;
const FORMATION_RADIUS = 38;
const BASE_PICKUP_RADIUS = 85;
const GEM_COLLECT_RADIUS = 20;
const HERO_PROJECTILE_SPEED = 460;
const HERO_ATTACK_RANGE = 240;
const TANK_SWEEP_RADIUS = 58;
const ENEMY_CONTACT_COOLDOWN = 0.8;
/** Floor on raw hit damage, so even a classless hero can slowly clear the first zone. */
const MIN_RAW_DAMAGE = 4;
/** Zone hazards (ZoneDefinition.hazard): first strike, warning time before impact, blast radius. */
const HAZARD_FIRST_SEC = 4;
export const HAZARD_WARNING_SEC = 1.1;
const HAZARD_RADIUS = 46;

// --- Deterministic spawn schedule (time-only, so the server can bound reported kills) ---

/** Waves grow by one enemy every 3 waves, up to this many extra (longer runs would otherwise
 *  flood the arena — the time ramp below takes over from there). */
const MAX_WAVE_GROWTH = 6;

export function waveSize(zone: ZoneDefinition, waveIndex: number): number {
  return zone.baseWaveSize + Math.min(MAX_WAVE_GROWTH, Math.floor(waveIndex / 3));
}

/** Monsters spawned later in a run are tougher: +60% HP and damage per minute elapsed
 *  (the boss gets half of it, on top of its own multipliers). */
const TIME_RAMP_PER_MIN = 0.6;

export function timeRamp(elapsedSec: number, kind: "normal" | "elite" | "boss" = "normal"): number {
  const ramp = TIME_RAMP_PER_MIN * (elapsedSec / 60);
  return 1 + (kind === "boss" ? ramp / 2 : ramp);
}

function isEliteWave(zone: ZoneDefinition, waveIndex: number): boolean {
  return waveIndex > 0 && waveIndex % zone.eliteEveryNWaves === 0;
}

/** Upper bound on enemies spawned (hence killable) by `sec` into a run of `zone`. */
export function maxKillsUntil(zone: ZoneDefinition, sec: number): number {
  let total = 0;
  for (let i = 0; i * zone.spawnIntervalSec <= sec; i++) {
    total += waveSize(zone, i) + (isEliteWave(zone, i) ? 1 : 0);
  }
  if (sec >= zone.boss.spawnAtSec) total += 1;
  return total;
}

// --- Spells ---

interface SpellTagDef {
  label: string;
  icon: string;
  cooldown: number;
  description: string;
}

/** What each arenaAbilityTag does when a hero auto-casts a spell carrying it. */
export const ARENA_SPELL_TAGS: Record<ArenaAbilityTag, SpellTagDef> = {
  cleave: { label: "Onde de choc", icon: "💥", cooldown: 4, description: "Dégâts de zone autour du lanceur" },
  multishot: { label: "Salve", icon: "🏹", cooldown: 3.5, description: "8 projectiles perforants en cercle" },
  regen: { label: "Soin de groupe", icon: "✨", cooldown: 5, description: "Soigne toute l'équipe" },
  haste: { label: "Frénésie", icon: "🍃", cooldown: 8, description: "+40% vitesse d'attaque d'équipe (3,5s)" },
  dmgbuff: { label: "Bénédiction", icon: "🛡️", cooldown: 9, description: "+30% dégâts d'équipe (4s)" },
  lifesteal: { label: "Drain", icon: "🩸", cooldown: 3, description: "Frappe la cible proche et soigne le lanceur" },
  nova: { label: "Nova de givre", icon: "❄️", cooldown: 5, description: "Dégâts autour du lanceur, ralentit les ennemis touchés (2,5s)" },
  chain: { label: "Arc électrique", icon: "⚡", cooldown: 3.5, description: "Frappe une cible puis rebondit sur 4 ennemis proches" },
  meteor: { label: "Météore", icon: "☄️", cooldown: 6, description: "Gros dégâts de zone sur le groupe d'ennemis le plus dense" },
  barrier: { label: "Égide", icon: "🔰", cooldown: 8, description: "Bouclier sur toute l'équipe, qui absorbe les prochains dégâts" },
  venom: { label: "Nuée toxique", icon: "☠️", cooldown: 5, description: "Empoisonne un groupe d'ennemis (dégâts sur 4s)" },
  execute: { label: "Coup de grâce", icon: "🗡️", cooldown: 3, description: "Frappe l'ennemi le plus blessé, dégâts doublés sous 35% PV" },
};

/** Nova slow: enemy speed multiplier while slowed. */
const NOVA_SLOW = 0.55;
/** Égide shields stack up to this fraction of each hero's max HP. */
const BARRIER_CAP = 0.35;

/** Spell matching the hero's class hits harder (same idea as raid combat's RAID_MAGNITUDE bonus). */
const CLASS_MATCH_BONUS = 1.3;

export interface ArenaSpell {
  spellId: string;
  name: string;
  tag: ArenaAbilityTag;
  power: number;
  timer: number;
}

// --- Monsters ---

type Behavior = "swarm" | "brute" | "ranged" | "caster";

const MONSTER_BEHAVIOR: Record<string, Behavior> = {
  "gobelin-eclaireur": "swarm",
  "golem-de-pierre": "brute",
  "araignee-venimeuse": "ranged",
  "seigneur-des-ombres": "caster",
};

const BEHAVIOR_TWEAKS: Record<Behavior, { hp: number; speed: number; radius: number }> = {
  swarm: { hp: 0.8, speed: 1.2, radius: 12 },
  brute: { hp: 1.5, speed: 0.65, radius: 18 },
  ranged: { hp: 0.9, speed: 0.9, radius: 13 },
  caster: { hp: 1, speed: 0.8, radius: 15 },
};

// --- State ---

export interface ArenaHeroInput {
  id: string;
  name: string;
  classId?: string;
  stats: HeroStats;
  equippedSpellIds: string[];
}

export interface ArenaHero {
  id: string;
  name: string;
  classId?: string;
  role?: Role;
  slot: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  atkType: "phys" | "mag";
  defPhys: number;
  defMag: number;
  spd: number;
  /** 0..0.75 crit probability from the hero's crit stat. */
  crit: number;
  critMul: number;
  element?: Element;
  res: Partial<Record<Element, number>>;
  attackCooldown: number;
  attackTimer: number;
  alive: boolean;
  spells: ArenaSpell[];
  /** Égide absorb pool, drained before HP. */
  shield: number;
}

export interface ArenaEnemy {
  id: number;
  refId: string;
  name: string;
  kind: "normal" | "elite" | "boss";
  behavior: Behavior;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  contactDamage: number;
  atkType: "phys" | "mag";
  defPhys: number;
  defMag: number;
  element?: Element;
  res: Partial<Record<Element, number>>;
  contactTimer: number;
  shootTimer: number;
  /** Seconds left under Nova de givre's slow. */
  slowTimer: number;
  /** Nuée toxique: seconds left and damage per second (already mitigated). */
  poisonTimer: number;
  poisonDps: number;
}

export interface ArenaProjectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  atkType: "phys" | "mag";
  /** Hero projectiles: the shooter's crit odds/multiplier. Element applies to both sides. */
  crit: number;
  critMul: number;
  element?: Element;
  radius: number;
  life: number;
  hostile: boolean;
  pierce: number;
  hitIds: number[];
  color: string;
}

export interface ArenaGem {
  id: number;
  x: number;
  y: number;
  value: number;
}

/** A telegraphed ground strike: marked on the floor, lands after `timer` seconds. */
export interface ArenaHazard {
  id: number;
  x: number;
  y: number;
  radius: number;
  timer: number;
}

export interface ArenaEffect {
  id: number;
  kind: "ring" | "beam" | "text";
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  text?: string;
}

export interface RunMods {
  dmgMul: number;
  atkSpeedMul: number;
  moveMul: number;
  pickupMul: number;
  extraProjectiles: number;
  pierce: number;
  damageTakenMul: number;
  regenPerSec: number;
  /** Extra crit chance from level-up cards, added to each hero's own. */
  critChance: number;
  spellPower: Record<ArenaAbilityTag, number>;
  spellCdMul: Record<ArenaAbilityTag, number>;
}

export interface ArenaState {
  heroes: ArenaHero[];
  leaderIndex: number;
  enemies: ArenaEnemy[];
  projectiles: ArenaProjectile[];
  gems: ArenaGem[];
  hazards: ArenaHazard[];
  /** Seconds until the zone's next hazard is marked. */
  hazardTimer: number;
  effects: ArenaEffect[];
  mods: RunMods;
  cardStacks: Record<string, number>;
  buffs: { hasteTimer: number; hasteMag: number; dmgTimer: number; dmgMag: number };
  level: number;
  xp: number;
  pendingLevelUps: number;
  /** Non-null while the run is paused on a level-up card choice. */
  pendingChoices: string[] | null;
  elapsedSec: number;
  nextWaveIndex: number;
  bossSpawned: boolean;
  bossKilled: boolean;
  killCount: number;
  heroesKo: number;
  nextId: number;
  outcome: "playing" | "victoire" | "defaite";
}

const ALL_TAGS = Object.keys(ARENA_SPELL_TAGS) as ArenaAbilityTag[];
const tagRecord = (value: number) =>
  Object.fromEntries(ALL_TAGS.map((t) => [t, value])) as Record<ArenaAbilityTag, number>;

export function xpToNextLevel(level: number): number {
  return 4 + level * 3;
}

export function createInitialState(
  party: ArenaHeroInput[],
  componentRanks: Record<string, number> = {},
): ArenaState {
  const heroes: ArenaHero[] = party.map((input, slot) => {
    const classDef = tryGetClass(input.classId);
    const { stats } = input;
    const spells: ArenaSpell[] = [];
    input.equippedSpellIds.slice(0, SPELL_SLOTS).forEach((spellId, i) => {
      const spell = tryGetSpell(spellId);
      if (!spell) return;
      const classBonus = spell.classId && spell.classId === input.classId ? CLASS_MATCH_BONUS : 1;
      spells.push({
        spellId,
        name: spell.name,
        tag: spell.arenaAbilityTag,
        power: classBonus * componentRankMultiplier(componentRanks[spellId] ?? 1),
        // Staggered first casts so a 4-spell hero doesn't fire everything at once.
        timer: 1 + i * 0.8 + slot * 0.3,
      });
    });
    const angle = (slot / Math.max(1, party.length)) * Math.PI * 2;
    return {
      id: input.id,
      name: input.name,
      classId: input.classId,
      role: classDef?.role,
      slot,
      x: ARENA_WIDTH / 2 + (slot === 0 ? 0 : Math.cos(angle) * FORMATION_RADIUS),
      y: ARENA_HEIGHT / 2 + (slot === 0 ? 0 : Math.sin(angle) * FORMATION_RADIUS),
      hp: stats.hp,
      maxHp: stats.hp,
      atk: Math.max(stats.atkPhys, stats.atkMag),
      atkType: stats.atkMag > stats.atkPhys ? "mag" : "phys",
      defPhys: stats.defPhys,
      defMag: stats.defMag,
      spd: stats.spd,
      crit: critChance(stats.crit),
      critMul: critMultiplier(stats.critDmg),
      element: heroElement(input),
      res: resistancesOf(stats),
      attackCooldown: Math.max(0.35, 1.05 - stats.spd * 0.012),
      attackTimer: 0.3 + slot * 0.15,
      alive: true,
      spells,
      shield: 0,
    };
  });

  return {
    heroes,
    leaderIndex: 0,
    enemies: [],
    projectiles: [],
    gems: [],
    hazards: [],
    hazardTimer: HAZARD_FIRST_SEC,
    effects: [],
    mods: {
      dmgMul: 1,
      atkSpeedMul: 1,
      moveMul: 1,
      pickupMul: 1,
      extraProjectiles: 0,
      pierce: 0,
      damageTakenMul: 1,
      regenPerSec: 0,
      critChance: 0,
      spellPower: tagRecord(1),
      spellCdMul: tagRecord(1),
    },
    cardStacks: {},
    buffs: { hasteTimer: 0, hasteMag: 0, dmgTimer: 0, dmgMag: 0 },
    level: 1,
    xp: 0,
    pendingLevelUps: 0,
    pendingChoices: null,
    elapsedSec: 0,
    nextWaveIndex: 0,
    bossSpawned: false,
    bossKilled: false,
    killCount: 0,
    heroesKo: 0,
    nextId: 1,
    outcome: "playing",
  };
}

// --- Upgrade cards ---

export interface UpgradeCard {
  id: string;
  name: string;
  icon: string;
  description: string;
  maxStacks: number;
  /** Extra eligibility check (beyond maxStacks). */
  available?: (state: ArenaState) => boolean;
  apply: (state: ArenaState) => void;
}

const GENERIC_CARDS: UpgradeCard[] = [
  { id: "force", name: "Fureur de l'arène", icon: "⚔️", description: "+20% dégâts de toute l'équipe (attaques et sorts)", maxStacks: 5, apply: (s) => void (s.mods.dmgMul += 0.2) },
  { id: "cadence", name: "Cadence", icon: "⏱️", description: "+15% vitesse des attaques de base", maxStacks: 5, apply: (s) => void (s.mods.atkSpeedMul += 0.15) },
  {
    id: "vitalite",
    name: "Vitalité",
    icon: "❤️",
    description: "+20% PV max, soigne 20% des PV de chaque héros",
    maxStacks: 4,
    apply: (s) => {
      for (const h of s.heroes) {
        if (!h.alive) continue;
        h.maxHp = Math.round(h.maxHp * 1.2);
        h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.2);
      }
    },
  },
  { id: "celerite", name: "Pas rapides", icon: "👟", description: "+12% vitesse de déplacement", maxStacks: 3, apply: (s) => void (s.mods.moveMul += 0.12) },
  { id: "aimant", name: "Aimant", icon: "🧲", description: "+50% rayon de ramassage d'XP", maxStacks: 3, apply: (s) => void (s.mods.pickupMul += 0.5) },
  { id: "multi", name: "Projectiles jumeaux", icon: "🎯", description: "+1 projectile par attaque de base", maxStacks: 3, apply: (s) => void (s.mods.extraProjectiles += 1) },
  { id: "perforant", name: "Perforation", icon: "📌", description: "Les projectiles traversent +1 ennemi", maxStacks: 3, apply: (s) => void (s.mods.pierce += 1) },
  { id: "peau", name: "Peau de pierre", icon: "🪨", description: "-12% dégâts subis", maxStacks: 4, apply: (s) => void (s.mods.damageTakenMul *= 0.88) },
  { id: "souffle", name: "Second souffle", icon: "🌬️", description: "Régénération : 1,5% des PV max par seconde", maxStacks: 3, apply: (s) => void (s.mods.regenPerSec += 0.015) },
  { id: "critique", name: "Coup critique", icon: "✴️", description: "+10% de chances de coup critique pour toute l'équipe", maxStacks: 4, apply: (s) => void (s.mods.critChance += 0.1) },
  {
    id: "ralliement",
    name: "Ralliement",
    icon: "🚩",
    description: "Relève les héros KO avec 40% PV",
    maxStacks: 99,
    available: (s) => s.heroes.some((h) => !h.alive),
    apply: (s) => {
      const leader = s.heroes[s.leaderIndex];
      for (const h of s.heroes) {
        if (h.alive) continue;
        h.alive = true;
        h.hp = h.maxHp * 0.4;
        h.x = leader.x;
        h.y = leader.y;
      }
    },
  },
  {
    id: "repos",
    name: "Pause bien méritée",
    icon: "🍖",
    description: "Soigne toute l'équipe de 35%",
    maxStacks: 99,
    apply: (s) => {
      for (const h of s.heroes) if (h.alive) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.35);
    },
  },
];

/** What each spell's "Maîtrise" level-up card adds on top of +15% power / -10% cooldown. The
 *  extra is read back in castSpell through spellCardLevel. */
const SPELL_CARD_BONUS: Record<ArenaAbilityTag, string> = {
  cleave: "+25% de rayon",
  multishot: "+3 projectiles par salve",
  regen: "+25% de soin",
  haste: "+1,5 s de durée",
  dmgbuff: "+1,5 s de durée",
  lifesteal: "soigne 20% de plus des dégâts infligés",
  nova: "+1 s de ralentissement",
  chain: "+2 rebonds",
  meteor: "+25% de rayon",
  barrier: "bouclier max +10% des PV",
  venom: "+2 s de poison",
  execute: "seuil d'exécution +10% PV",
};

function spellCardLevel(state: ArenaState, tag: ArenaAbilityTag): number {
  return state.cardStacks[`sort-${tag}`] ?? 0;
}

function spellCard(tag: ArenaAbilityTag): UpgradeCard {
  const def = ARENA_SPELL_TAGS[tag];
  return {
    id: `sort-${tag}`,
    name: `Maîtrise : ${def.label}`,
    icon: def.icon,
    description: `${def.label} : ${SPELL_CARD_BONUS[tag]}, +15% puissance, -10% recharge`,
    maxStacks: 3,
    available: (s) => s.heroes.some((h) => h.spells.some((sp) => sp.tag === tag)),
    apply: (s) => {
      s.mods.spellPower[tag] += tag === "regen" ? 0.4 : 0.15;
      s.mods.spellCdMul[tag] *= 0.9;
    },
  };
}

const ALL_CARDS: UpgradeCard[] = [...GENERIC_CARDS, ...ALL_TAGS.map(spellCard)];

export function getCard(id: string): UpgradeCard | undefined {
  return ALL_CARDS.find((c) => c.id === id);
}

function rollChoices(state: ArenaState, rng: () => number): string[] {
  const eligible = ALL_CARDS.filter(
    (c) => (state.cardStacks[c.id] ?? 0) < c.maxStacks && (c.available?.(state) ?? true) && c.id !== "repos",
  );
  const picks: string[] = [];
  // Spell cards are what make a build feel different run to run — give them a better shot.
  const weighted = eligible.flatMap((c) => (c.id.startsWith("sort-") ? [c, c] : [c]));
  while (picks.length < 3 && weighted.length > 0) {
    const card = weighted[randomInt(rng, 0, weighted.length - 1)];
    if (!picks.includes(card.id)) picks.push(card.id);
    for (let i = weighted.length - 1; i >= 0; i--) if (weighted[i].id === card.id) weighted.splice(i, 1);
  }
  if (picks.length < 3) picks.push("repos");
  return picks;
}

/** Applies the chosen level-up card and resumes the run (or offers the next pending level-up). */
export function chooseUpgrade(state: ArenaState, cardId: string, rng: () => number): ArenaState {
  if (!state.pendingChoices?.includes(cardId)) return state;
  const card = getCard(cardId);
  if (card) {
    card.apply(state);
    state.cardStacks[cardId] = (state.cardStacks[cardId] ?? 0) + 1;
  }
  state.pendingLevelUps -= 1;
  state.pendingChoices = state.pendingLevelUps > 0 ? rollChoices(state, rng) : null;
  return state;
}

// --- Helpers ---

function addEffect(state: ArenaState, effect: Omit<ArenaEffect, "id" | "maxLife">) {
  state.effects.push({ ...effect, id: state.nextId++, maxLife: effect.life });
}

function aliveHeroes(state: ArenaState): ArenaHero[] {
  return state.heroes.filter((h) => h.alive);
}

function nearestEnemy(state: ArenaState, x: number, y: number, range: number): ArenaEnemy | undefined {
  let best: ArenaEnemy | undefined;
  let bestDist = range;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const dist = Math.hypot(enemy.x - x, enemy.y - y) - enemy.radius;
    if (dist < bestDist) {
      bestDist = dist;
      best = enemy;
    }
  }
  return best;
}

/** Who landed a hit on an enemy: crit odds/multiplier and damage element. */
interface HitSource {
  crit: number;
  critMul: number;
  element?: Element;
}

function damageEnemy(
  state: ArenaState,
  enemy: ArenaEnemy,
  raw: number,
  type: "phys" | "mag",
  rng: () => number,
  source: HitSource,
): number {
  if (enemy.hp <= 0) return 0;
  const crit = rng() < source.crit + state.mods.critChance;
  const boosted = Math.max(MIN_RAW_DAMAGE, raw) * state.mods.dmgMul * (1 + state.buffs.dmgMag) * (crit ? source.critMul : 1);
  const def = type === "phys" ? enemy.defPhys : enemy.defMag;
  const elemMul = source.element ? elementalMultiplier(source.element, enemy.res[source.element]) : 1;
  const dealt = Math.max(boosted * 0.25, boosted - def * 0.5) * elemMul;
  enemy.hp -= dealt;
  if (crit) {
    // Weakness crits get a double "!!" so exploiting an element reads on screen.
    const color = source.element ? ELEMENT_COLOR[source.element] : "#fde047";
    addEffect(state, { kind: "text", x: enemy.x, y: enemy.y - enemy.radius, radius: 0, life: 0.5, color, text: `${Math.round(dealt)}${elemMul > 1 ? "!!" : "!"}` });
  }
  return dealt;
}

function damageHero(state: ArenaState, hero: ArenaHero, raw: number, type: "phys" | "mag", element?: Element) {
  if (!hero.alive) return;
  const def = type === "phys" ? hero.defPhys : hero.defMag;
  const elemMul = element ? elementalMultiplier(element, hero.res[element]) : 1;
  loseHp(state, hero, Math.max(raw * 0.25, raw - def * 0.5) * state.mods.damageTakenMul * elemMul);
}

/** Final HP loss (already mitigated), with the KO bookkeeping. */
function loseHp(state: ArenaState, hero: ArenaHero, amount: number) {
  const absorbed = Math.min(hero.shield, amount);
  hero.shield -= absorbed;
  hero.hp -= amount - absorbed;
  if (hero.hp <= 0) {
    hero.hp = 0;
    hero.alive = false;
    state.heroesKo += 1;
    addEffect(state, { kind: "text", x: hero.x, y: hero.y - 20, radius: 0, life: 1, color: "#f87171", text: "KO" });
  }
}

function healHero(state: ArenaState, hero: ArenaHero, amount: number) {
  if (!hero.alive) return;
  hero.hp = Math.min(hero.maxHp, hero.hp + amount);
}

function fireProjectile(
  state: ArenaState,
  from: { x: number; y: number },
  angle: number,
  opts: {
    damage: number;
    atkType: "phys" | "mag";
    hostile: boolean;
    speed: number;
    pierce: number;
    color: string;
    radius?: number;
    crit?: number;
    critMul?: number;
    element?: Element;
  },
) {
  state.projectiles.push({
    id: state.nextId++,
    x: from.x,
    y: from.y,
    vx: Math.cos(angle) * opts.speed,
    vy: Math.sin(angle) * opts.speed,
    damage: opts.damage,
    atkType: opts.atkType,
    crit: opts.crit ?? 0,
    critMul: opts.critMul ?? 1,
    element: opts.element,
    radius: opts.radius ?? 5,
    life: 1.6,
    hostile: opts.hostile,
    pierce: opts.pierce,
    hitIds: [],
    color: opts.color,
  });
}

// --- Spawning ---

function spawnEnemy(
  state: ArenaState,
  zone: ZoneDefinition,
  rng: () => number,
  refId: string,
  kind: ArenaEnemy["kind"],
) {
  const def = getMonster(refId);
  const behavior = MONSTER_BEHAVIOR[refId] ?? "swarm";
  const tweak = BEHAVIOR_TWEAKS[behavior];
  const scale = zone.statScale;
  const kindHp = kind === "boss" ? zone.boss.hpMultiplier : kind === "elite" ? 4 : 1;
  const kindAtk = kind === "boss" ? zone.boss.atkMultiplier : kind === "elite" ? 1.5 : 1;
  const kindRadius = kind === "boss" ? 2.2 : kind === "elite" ? 1.4 : 1;

  let x: number;
  let y: number;
  if (kind === "boss") {
    x = ARENA_WIDTH / 2;
    y = 30;
  } else {
    const side = randomInt(rng, 0, 3);
    x = side === 0 ? 0 : side === 1 ? ARENA_WIDTH : randomInt(rng, 0, ARENA_WIDTH);
    y = side === 2 ? 0 : side === 3 ? ARENA_HEIGHT : randomInt(rng, 0, ARENA_HEIGHT);
  }

  const ramp = timeRamp(state.elapsedSec, kind);
  const hp = def.stats.hp * 0.35 * scale * tweak.hp * kindHp * ramp;
  state.enemies.push({
    id: state.nextId++,
    refId,
    name: kind === "boss" ? zone.boss.name : def.name,
    kind,
    behavior,
    x,
    y,
    radius: tweak.radius * kindRadius,
    hp,
    maxHp: hp,
    speed: (35 + def.stats.spd * 2) * tweak.speed * (kind === "normal" ? 1 : 0.85),
    contactDamage: Math.max(2, (def.stats.atkPhys + def.stats.atkMag) * 0.4 * scale * kindAtk * ramp),
    atkType: def.stats.atkMag > def.stats.atkPhys ? "mag" : "phys",
    defPhys: def.stats.defPhys * scale,
    defMag: def.stats.defMag * scale,
    element: def.element,
    res: resistancesOf(def.stats),
    contactTimer: 0,
    shootTimer: 1.5 + rng() * 1.5,
    slowTimer: 0,
    poisonTimer: 0,
    poisonDps: 0,
  });
}

function runSpawns(state: ArenaState, zone: ZoneDefinition, rng: () => number) {
  while (state.nextWaveIndex * zone.spawnIntervalSec <= state.elapsedSec) {
    const wave = state.nextWaveIndex++;
    for (let i = 0; i < waveSize(zone, wave); i++) {
      spawnEnemy(state, zone, rng, zone.monsterPool[randomInt(rng, 0, zone.monsterPool.length - 1)], "normal");
    }
    if (isEliteWave(zone, wave)) {
      spawnEnemy(state, zone, rng, zone.monsterPool[randomInt(rng, 0, zone.monsterPool.length - 1)], "elite");
    }
  }
  if (!state.bossSpawned && state.elapsedSec >= zone.boss.spawnAtSec) {
    state.bossSpawned = true;
    spawnEnemy(state, zone, rng, zone.boss.refId, "boss");
    addEffect(state, { kind: "text", x: ARENA_WIDTH / 2, y: 70, radius: 0, life: 2, color: "#f87171", text: `${zone.boss.name} surgit !` });
  }
}

// --- Hero actions ---

function heroBasicAttack(state: ArenaState, hero: ArenaHero, rng: () => number) {
  if (hero.role === "TANK") {
    let hit = false;
    for (const enemy of state.enemies) {
      if (Math.hypot(enemy.x - hero.x, enemy.y - hero.y) - enemy.radius <= TANK_SWEEP_RADIUS) {
        damageEnemy(state, enemy, hero.atk * 0.8, hero.atkType, rng, hero);
        hit = true;
      }
    }
    if (hit) addEffect(state, { kind: "ring", x: hero.x, y: hero.y, radius: TANK_SWEEP_RADIUS, life: 0.2, color: "#fbbf24" });
    return hit;
  }

  if (hero.role === "HEAL") {
    const wounded = aliveHeroes(state)
      .filter((h) => h.hp / h.maxHp < 0.9)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (wounded) {
      healHero(state, wounded, 5 + hero.atk * 0.7);
      addEffect(state, { kind: "beam", x: hero.x, y: hero.y, x2: wounded.x, y2: wounded.y, radius: 0, life: 0.25, color: "#6ee7b7" });
      return true;
    }
  }

  const target = nearestEnemy(state, hero.x, hero.y, HERO_ATTACK_RANGE);
  if (!target) return false;
  const base = Math.atan2(target.y - hero.y, target.x - hero.x);
  const count = 1 + state.mods.extraProjectiles;
  const damage = hero.role === "HEAL" ? hero.atk * 0.6 : hero.atk;
  for (let i = 0; i < count; i++) {
    const spread = (i - (count - 1) / 2) * 0.18;
    fireProjectile(state, hero, base + spread, {
      damage,
      atkType: hero.atkType,
      hostile: false,
      speed: HERO_PROJECTILE_SPEED,
      pierce: state.mods.pierce,
      color: hero.element ? ELEMENT_COLOR[hero.element] : hero.atkType === "mag" ? "#c4b5fd" : "#fde047",
      crit: hero.crit,
      critMul: hero.critMul,
      element: hero.element,
    });
  }
  return true;
}

function castSpell(state: ArenaState, hero: ArenaHero, spell: ArenaSpell, rng: () => number): boolean {
  const power = spell.power * state.mods.spellPower[spell.tag];
  const lvl = spellCardLevel(state, spell.tag);
  switch (spell.tag) {
    case "cleave": {
      const radius = 85 * (1 + 0.25 * lvl);
      const targets = state.enemies.filter((e) => Math.hypot(e.x - hero.x, e.y - hero.y) - e.radius <= radius);
      if (targets.length === 0) return false;
      for (const enemy of targets) damageEnemy(state, enemy, hero.atk * 1.4 * power, hero.atkType, rng, hero);
      addEffect(state, { kind: "ring", x: hero.x, y: hero.y, radius, life: 0.35, color: "#fb923c" });
      return true;
    }
    case "multishot": {
      if (!nearestEnemy(state, hero.x, hero.y, 320)) return false;
      const count = 8 + 3 * lvl;
      for (let i = 0; i < count; i++) {
        fireProjectile(state, hero, (i / count) * Math.PI * 2, {
          damage: hero.atk * 0.7 * power,
          atkType: hero.atkType,
          hostile: false,
          speed: 380,
          pierce: 1 + state.mods.pierce,
          color: hero.element ? ELEMENT_COLOR[hero.element] : "#fdba74",
          radius: 6,
          crit: hero.crit,
          critMul: hero.critMul,
          element: hero.element,
        });
      }
      return true;
    }
    case "regen": {
      const party = aliveHeroes(state);
      if (!party.some((h) => h.hp / h.maxHp < 0.95)) return false;
      for (const h of party) {
        healHero(state, h, (6 + hero.atk * 0.5) * power);
        addEffect(state, { kind: "ring", x: h.x, y: h.y, radius: 20, life: 0.4, color: "#6ee7b7" });
      }
      return true;
    }
    case "haste": {
      if (state.enemies.length === 0) return false;
      state.buffs.hasteTimer = 3.5 + 1.5 * lvl;
      state.buffs.hasteMag = Math.max(state.buffs.hasteMag, 0.4 * power);
      addEffect(state, { kind: "ring", x: hero.x, y: hero.y, radius: 50, life: 0.4, color: "#67e8f9" });
      return true;
    }
    case "dmgbuff": {
      if (state.enemies.length === 0) return false;
      state.buffs.dmgTimer = 4 + 1.5 * lvl;
      state.buffs.dmgMag = Math.max(state.buffs.dmgMag, 0.3 * power);
      addEffect(state, { kind: "ring", x: hero.x, y: hero.y, radius: 60, life: 0.4, color: "#fcd34d" });
      return true;
    }
    case "lifesteal": {
      const target = nearestEnemy(state, hero.x, hero.y, 220);
      if (!target) return false;
      const dealt = damageEnemy(state, target, hero.atk * 1.6 * power, hero.atkType, rng, hero);
      healHero(state, hero, dealt * (0.5 + 0.2 * lvl));
      addEffect(state, { kind: "beam", x: hero.x, y: hero.y, x2: target.x, y2: target.y, radius: 0, life: 0.3, color: "#f87171" });
      return true;
    }
    case "nova": {
      const radius = 110;
      const targets = state.enemies.filter((e) => Math.hypot(e.x - hero.x, e.y - hero.y) - e.radius <= radius);
      if (targets.length === 0) return false;
      for (const enemy of targets) {
        damageEnemy(state, enemy, hero.atk * 0.9 * power, hero.atkType, rng, hero);
        enemy.slowTimer = 2.5 + lvl;
      }
      addEffect(state, { kind: "ring", x: hero.x, y: hero.y, radius, life: 0.45, color: "#7dd3fc" });
      return true;
    }
    case "chain": {
      let current = nearestEnemy(state, hero.x, hero.y, 260);
      if (!current) return false;
      const hit = new Set<number>();
      let from = { x: hero.x, y: hero.y };
      let damage = hero.atk * 1.2 * power;
      for (let bounce = 0; bounce < 5 + 2 * lvl && current; bounce++) {
        damageEnemy(state, current, damage, hero.atkType, rng, hero);
        hit.add(current.id);
        addEffect(state, { kind: "beam", x: from.x, y: from.y, x2: current.x, y2: current.y, radius: 0, life: 0.25, color: "#fde047" });
        from = { x: current.x, y: current.y };
        damage *= 0.85;
        let next: ArenaEnemy | undefined;
        let best = 150;
        for (const e of state.enemies) {
          if (e.hp <= 0 || hit.has(e.id)) continue;
          const d = Math.hypot(e.x - from.x, e.y - from.y);
          if (d < best) {
            best = d;
            next = e;
          }
        }
        current = next;
      }
      return true;
    }
    case "meteor": {
      const blast = 75 * (1 + 0.25 * lvl);
      let center: ArenaEnemy | undefined;
      let bestCount = 0;
      for (const e of state.enemies) {
        if (e.hp <= 0 || Math.hypot(e.x - hero.x, e.y - hero.y) > 380) continue;
        const count = state.enemies.filter((o) => Math.hypot(o.x - e.x, o.y - e.y) <= blast).length;
        if (count > bestCount) {
          bestCount = count;
          center = e;
        }
      }
      if (!center) return false;
      const { x, y } = center;
      for (const enemy of state.enemies) {
        if (Math.hypot(enemy.x - x, enemy.y - y) - enemy.radius <= blast) {
          damageEnemy(state, enemy, hero.atk * 2 * power, hero.atkType, rng, hero);
        }
      }
      addEffect(state, { kind: "ring", x, y, radius: blast, life: 0.5, color: "#f97316" });
      return true;
    }
    case "barrier": {
      if (state.enemies.length === 0) return false;
      const party = aliveHeroes(state);
      const cap = BARRIER_CAP + 0.1 * lvl;
      if (party.every((h) => h.shield >= h.maxHp * cap * 0.9)) return false;
      for (const h of party) {
        h.shield = Math.min(h.maxHp * cap, h.shield + (5 + h.maxHp * 0.12 + hero.atk * 0.3) * power);
        addEffect(state, { kind: "ring", x: h.x, y: h.y, radius: 22, life: 0.4, color: "#93c5fd" });
      }
      return true;
    }
    case "venom": {
      const target = nearestEnemy(state, hero.x, hero.y, 300);
      if (!target) return false;
      const radius = 90;
      const dps = hero.atk * 0.55 * power * state.mods.dmgMul;
      for (const enemy of state.enemies) {
        if (Math.hypot(enemy.x - target.x, enemy.y - target.y) > radius) continue;
        const elemMul = hero.element ? elementalMultiplier(hero.element, enemy.res[hero.element]) : 1;
        enemy.poisonDps = Math.max(enemy.poisonTimer > 0 ? enemy.poisonDps : 0, dps * elemMul);
        enemy.poisonTimer = 4 + 2 * lvl;
      }
      addEffect(state, { kind: "ring", x: target.x, y: target.y, radius, life: 0.6, color: "#a3e635" });
      return true;
    }
    case "execute": {
      let target: ArenaEnemy | undefined;
      for (const e of state.enemies) {
        if (e.hp <= 0 || Math.hypot(e.x - hero.x, e.y - hero.y) - e.radius > 260) continue;
        if (!target || e.hp / e.maxHp < target.hp / target.maxHp) target = e;
      }
      if (!target) return false;
      const finisher = target.hp / target.maxHp < 0.35 + 0.1 * lvl ? 2 : 1;
      damageEnemy(state, target, hero.atk * 1.5 * finisher * power, hero.atkType, rng, hero);
      addEffect(state, { kind: "beam", x: hero.x, y: hero.y, x2: target.x, y2: target.y, radius: 0, life: 0.25, color: "#e2e8f0" });
      return true;
    }
  }
}

// --- Main step ---

export interface ArenaInput {
  dx: number;
  dy: number;
}

/** Advances the simulation by `dt` seconds. Mutates and returns `state`. Paused while a level-up
 *  card choice is pending (see chooseUpgrade). */
export function stepArena(
  state: ArenaState,
  dt: number,
  input: ArenaInput,
  zone: ZoneDefinition,
  rng: () => number,
): ArenaState {
  if (state.outcome !== "playing" || state.pendingChoices) return state;

  state.elapsedSec += dt;
  runSpawns(state, zone, rng);

  // Buffs & passive regen.
  state.buffs.hasteTimer = Math.max(0, state.buffs.hasteTimer - dt);
  if (state.buffs.hasteTimer === 0) state.buffs.hasteMag = 0;
  state.buffs.dmgTimer = Math.max(0, state.buffs.dmgTimer - dt);
  if (state.buffs.dmgTimer === 0) state.buffs.dmgMag = 0;
  if (state.mods.regenPerSec > 0) {
    for (const h of aliveHeroes(state)) healHero(state, h, h.maxHp * state.mods.regenPerSec * dt);
  }

  // Movement: the leader follows input, the others keep formation around it.
  const party = aliveHeroes(state);
  if (party.length === 0) {
    state.outcome = "defaite";
    return state;
  }
  if (!state.heroes[state.leaderIndex].alive) state.leaderIndex = state.heroes.indexOf(party[0]);
  const leader = state.heroes[state.leaderIndex];
  const avgSpd = party.reduce((sum, h) => sum + h.spd, 0) / party.length;
  const moveSpeed = Math.min(220, 95 + avgSpd * 2.5) * state.mods.moveMul;
  const len = Math.hypot(input.dx, input.dy);
  if (len > 0) {
    leader.x += (input.dx / len) * moveSpeed * dt;
    leader.y += (input.dy / len) * moveSpeed * dt;
  }
  const followers = party.filter((h) => h !== leader);
  followers.forEach((hero, i) => {
    const angle = (i / followers.length) * Math.PI * 2 + Math.PI / 2;
    const tx = leader.x + Math.cos(angle) * FORMATION_RADIUS;
    const ty = leader.y + Math.sin(angle) * FORMATION_RADIUS;
    const dist = Math.hypot(tx - hero.x, ty - hero.y);
    const step = Math.min(dist, moveSpeed * 1.4 * dt);
    if (dist > 0.5) {
      hero.x += ((tx - hero.x) / dist) * step;
      hero.y += ((ty - hero.y) / dist) * step;
    }
  });
  for (const hero of party) {
    hero.x = Math.min(ARENA_WIDTH - HERO_RADIUS, Math.max(HERO_RADIUS, hero.x));
    hero.y = Math.min(ARENA_HEIGHT - HERO_RADIUS, Math.max(HERO_RADIUS, hero.y));
  }

  // Enemies: chase the nearest hero (tanks draw aggro), contact damage, ranged/boss shots.
  for (const enemy of state.enemies) {
    let target = party[0];
    let targetScore = Infinity;
    let targetDist = Infinity;
    for (const hero of party) {
      const dist = Math.hypot(hero.x - enemy.x, hero.y - enemy.y);
      const score = hero.role === "TANK" ? dist * 0.55 : dist;
      if (score < targetScore) {
        targetScore = score;
        target = hero;
        targetDist = dist;
      }
    }
    const dx = (target.x - enemy.x) / (targetDist || 1);
    const dy = (target.y - enemy.y) / (targetDist || 1);
    let dir = 1;
    if (enemy.behavior === "ranged" && enemy.kind !== "boss") {
      dir = targetDist > 160 ? 1 : targetDist < 110 ? -1 : 0;
    }
    const speed = enemy.speed * (enemy.slowTimer > 0 ? NOVA_SLOW : 1);
    enemy.x = Math.min(ARENA_WIDTH, Math.max(0, enemy.x + dx * speed * dir * dt));
    enemy.y = Math.min(ARENA_HEIGHT, Math.max(0, enemy.y + dy * speed * dir * dt));
    if (enemy.slowTimer > 0) enemy.slowTimer -= dt;
    if (enemy.poisonTimer > 0) {
      enemy.poisonTimer -= dt;
      enemy.hp -= enemy.poisonDps * dt;
    }

    enemy.contactTimer -= dt;
    if (enemy.contactTimer <= 0) {
      for (const hero of party) {
        if (Math.hypot(hero.x - enemy.x, hero.y - enemy.y) < HERO_RADIUS + enemy.radius) {
          damageHero(state, hero, enemy.contactDamage, enemy.atkType, enemy.element);
          enemy.contactTimer = ENEMY_CONTACT_COOLDOWN;
          break;
        }
      }
    }

    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0) {
      if (enemy.kind === "boss") {
        const count = enemy.behavior === "caster" ? 14 : 10;
        const offset = rng() * Math.PI;
        for (let i = 0; i < count; i++) {
          fireProjectile(state, enemy, offset + (i / count) * Math.PI * 2, {
            damage: enemy.contactDamage * 0.6,
            atkType: enemy.atkType,
            element: enemy.element,
            hostile: true,
            speed: 170,
            pierce: 0,
            color: "#f87171",
            radius: 7,
          });
        }
        enemy.shootTimer = 3.2;
      } else if (enemy.behavior === "ranged" && targetDist < 320) {
        fireProjectile(state, enemy, Math.atan2(dy, dx), {
          damage: enemy.contactDamage * 0.8,
          atkType: enemy.atkType,
          element: enemy.element,
          hostile: true,
          speed: 220,
          pierce: 0,
          color: "#a3e635",
        });
        enemy.shootTimer = 2.4;
      } else {
        enemy.shootTimer = 1;
      }
    }
  }

  // Light separation so packs don't collapse into a single sprite.
  for (let i = 0; i < state.enemies.length; i++) {
    const a = state.enemies[i];
    for (let j = i + 1; j < state.enemies.length; j++) {
      const b = state.enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const overlap = a.radius + b.radius - dist;
      if (overlap > 0) {
        const push = overlap / 2 / dist;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }
  }

  // Hero basic attacks and spell casts.
  const attackSpeed = state.mods.atkSpeedMul * (1 + state.buffs.hasteMag);
  for (const hero of party) {
    hero.attackTimer -= dt * attackSpeed;
    if (hero.attackTimer <= 0 && heroBasicAttack(state, hero, rng)) {
      hero.attackTimer = hero.role === "HEAL" ? hero.attackCooldown * 1.2 : hero.attackCooldown;
    }
    for (const spell of hero.spells) {
      spell.timer -= dt;
      if (spell.timer <= 0 && castSpell(state, hero, spell, rng)) {
        spell.timer = ARENA_SPELL_TAGS[spell.tag].cooldown * state.mods.spellCdMul[spell.tag];
      }
    }
  }

  // Projectiles.
  for (const p of state.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.hostile) {
      for (const hero of party) {
        if (hero.alive && Math.hypot(hero.x - p.x, hero.y - p.y) < HERO_RADIUS + p.radius) {
          damageHero(state, hero, p.damage, p.atkType, p.element);
          p.life = 0;
          break;
        }
      }
    } else {
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0 || p.hitIds.includes(enemy.id)) continue;
        if (Math.hypot(enemy.x - p.x, enemy.y - p.y) < enemy.radius + p.radius) {
          damageEnemy(state, enemy, p.damage, p.atkType, rng, p);
          p.hitIds.push(enemy.id);
          if (p.pierce <= 0) {
            p.life = 0;
            break;
          }
          p.pierce -= 1;
        }
      }
    }
  }
  state.projectiles = state.projectiles.filter(
    (p) => p.life > 0 && p.x >= -10 && p.x <= ARENA_WIDTH + 10 && p.y >= -10 && p.y <= ARENA_HEIGHT + 10,
  );

  // Deaths → XP gems.
  const dead = state.enemies.filter((e) => e.hp <= 0);
  if (dead.length > 0) {
    for (const enemy of dead) {
      state.killCount += 1;
      if (enemy.kind === "boss") {
        state.bossKilled = true;
        addEffect(state, { kind: "ring", x: enemy.x, y: enemy.y, radius: 120, life: 0.8, color: "#fde047" });
      } else {
        state.gems.push({ id: state.nextId++, x: enemy.x, y: enemy.y, value: enemy.kind === "elite" ? 6 : 1 });
      }
    }
    state.enemies = state.enemies.filter((e) => e.hp > 0);
  }

  // Zone hazards: marked on a hero's spot, land after a warning — standing still eats every one.
  // Percent of max HP (only "Peau de pierre" reduces it), so a high-defense tank can't ignore them.
  const hazard = zone.hazard;
  if (hazard) {
    state.hazardTimer -= dt;
    if (state.hazardTimer <= 0) {
      const target = party[randomInt(rng, 0, party.length - 1)];
      state.hazards.push({ id: state.nextId++, x: target.x, y: target.y, radius: HAZARD_RADIUS, timer: HAZARD_WARNING_SEC });
      state.hazardTimer = hazard.intervalSec;
    }
    for (const hz of state.hazards) {
      hz.timer -= dt;
      if (hz.timer > 0) continue;
      for (const hero of party) {
        if (hero.alive && Math.hypot(hero.x - hz.x, hero.y - hz.y) < hz.radius + HERO_RADIUS * 0.5) {
          loseHp(state, hero, hero.maxHp * hazard.damagePct * state.mods.damageTakenMul);
        }
      }
      addEffect(state, { kind: "ring", x: hz.x, y: hz.y, radius: hz.radius, life: 0.3, color: "#f97316" });
    }
    state.hazards = state.hazards.filter((hz) => hz.timer > 0);
  }

  // Gems: magnet toward the party, collected on touch.
  const pickupRadius = BASE_PICKUP_RADIUS * state.mods.pickupMul;
  for (const gem of state.gems) {
    let nearest = party[0];
    let nearestDist = Infinity;
    for (const hero of party) {
      const dist = Math.hypot(hero.x - gem.x, hero.y - gem.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = hero;
      }
    }
    if (nearestDist < GEM_COLLECT_RADIUS) {
      state.xp += gem.value;
      gem.value = 0;
    } else if (nearestDist < pickupRadius) {
      const pull = Math.min(nearestDist, 320 * dt);
      gem.x += ((nearest.x - gem.x) / nearestDist) * pull;
      gem.y += ((nearest.y - gem.y) / nearestDist) * pull;
    }
  }
  state.gems = state.gems.filter((g) => g.value > 0);
  while (state.xp >= xpToNextLevel(state.level)) {
    state.xp -= xpToNextLevel(state.level);
    state.level += 1;
    state.pendingLevelUps += 1;
  }

  for (const effect of state.effects) effect.life -= dt;
  state.effects = state.effects.filter((e) => e.life > 0);

  if (aliveHeroes(state).length === 0) {
    state.outcome = "defaite";
  } else if (state.bossKilled || state.elapsedSec >= zone.durationSec) {
    state.outcome = "victoire";
  } else if (state.pendingLevelUps > 0) {
    state.pendingChoices = rollChoices(state, rng);
  }

  return state;
}

export function runResult(state: ArenaState): ArenaRunResult {
  return {
    survived: state.outcome === "victoire",
    timeSurvivedMs: Math.round(state.elapsedSec * 1000),
    killCount: state.killCount,
    bossKilled: state.bossKilled,
    heroesKo: state.heroesKo,
    levelReached: state.level,
  };
}

/** 1★ survived, 2★ boss killed, 3★ boss killed with no hero knocked out. */
export function runStars(result: Pick<ArenaRunResult, "survived" | "bossKilled" | "heroesKo">): number {
  if (!result.survived) return 0;
  if (!result.bossKilled) return 1;
  return result.heroesKo === 0 ? 3 : 2;
}

export function createArenaRng(seed: string): () => number {
  return createRng(seed);
}

export const ARENA_CONSTANTS = { HERO_RADIUS };
