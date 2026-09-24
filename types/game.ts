// Shared domain types for the game. Player-owned documents live in Firestore
// with this shape; static game content (classes, zones, recipes...) lives in
// lib/game/content and is referenced by id from these documents.

export type Role = "DPS" | "HEAL" | "TANK";

export type HeroStatus = "idle" | "expedition" | "dungeon-guard" | "dungeon-raid";

/** Attack/defense are split by damage type: a unit's actual attack in combat uses whichever of
 *  atkPhys/atkMag is higher, mitigated by the target's matching defense (defPhys vs physical
 *  attacks, defMag vs magical) — see lib/game/engine/dungeonCombat.ts. */
export interface HeroStats {
  hp: number;
  atkPhys: number;
  atkMag: number;
  defPhys: number;
  defMag: number;
  spd: number;
}

/** A talent tree node, owned via gacha before it can be spent into (see UserProfile.componentRanks). */
export interface TalentNode {
  id: string;
  /** The class this node's tree belongs to. A hero's talent investment in a class stays banked even while a different class is active. */
  classId: string;
  name: string;
  description: string;
  tier: number;
  cost: number;
  maxRank: number;
  requires?: string;
  /** Minimum hero star rank needed to unlock this node, in addition to `requires`. */
  requiresStarRank?: number;
  statBonusPerRank: Partial<HeroStats>;
}

export type ArenaAbilityTag = "cleave" | "multishot" | "regen" | "haste" | "dmgbuff" | "lifesteal";

/** How a spell modifies its owner's attack during turn-based dungeon-raid combat
 *  (lib/game/engine/dungeonCombat.ts): splash damage to a second target, bonus damage
 *  vs a weakened target, defense-piercing, a stun, self-healing on hit, bonus damage
 *  framed as poison, a shield against the next hit taken, or (HEAL-role units only) a
 *  boosted per-round heal instead of attacking. */
export type RaidEffectTag = "cleave" | "execute" | "pierce" | "stun" | "lifesteal" | "poison" | "shield" | "heal";

/** An active attack spell, owned via gacha, equipped into one of a hero's spell slots.
 *  Has two distinct combat effects: one for turn-based dungeon raids, one for the
 *  real-time arena mini-game — never a passive stat bonus. */
export interface SpellDefinition {
  id: string;
  /** Equippable on any hero regardless of class — this is just the class that gets a
   *  potency bonus when it matches the hero's active class (see RAID_MAGNITUDE in
   *  dungeonCombat.ts and CLASS_MATCH_BONUS in arena/engine.ts). Undefined = no class bonus. */
  classId?: string;
  name: string;
  description: string;
  /** How this spell modifies its owner's attack in turn-based dungeon-raid combat. */
  raidEffectTag: RaidEffectTag;
  /** How this spell modifies its owner's contribution to the real-time arena mini-game. */
  arenaAbilityTag: ArenaAbilityTag;
}

/** A universal (class-agnostic) passive stat bonus, owned via gacha, equipped into one of a hero's mastery slots. */
export interface MasteryDefinition {
  id: string;
  name: string;
  description: string;
  statBonus: Partial<HeroStats>;
}

export interface ClassDefinition {
  id: string;
  role: Role;
  name: string;
  description: string;
  strengths: string;
  weaknesses: string;
  baseStats: HeroStats;
  statGrowthPerLevel: HeroStats;
}

/** A saved loadout ("ensemble"): the freely-swappable half of a build (class + spells + masteries).
 *  Talent point investment is NOT part of a build — it stays banked per class (see TalentNode.classId)
 *  and is restored automatically whenever that class becomes active again. */
export interface HeroBuild {
  id: string;
  name: string;
  classId?: string;
  equippedSpellIds: string[];
  equippedMasteryIds: string[];
}

export interface Hero {
  id: string;
  ownerId: string;
  name: string;
  /** Undefined until the player assigns a class (via gacha-unlocked classes). A classless hero can't fight. */
  classId?: string;
  level: number;
  xp: number;
  /** 1 to 5. Raises the level cap and grants a flat stat bonus; increased by spending rank tokens. */
  starRank: number;
  talentPoints: number;
  /** Points spent per talent node id, across ALL classes ever played (see TalentNode.classId) — only nodes matching the active class currently apply. */
  talents: Record<string, number>;
  equippedSpellIds: string[];
  equippedMasteryIds: string[];
  equipment: Partial<Record<ItemSlot, string>>;
  builds: HeroBuild[];
  status: HeroStatus;
  createdAt: number;
}

export type ItemSlot = "weapon" | "armor" | "trinket";
export type ItemRarity = "commun" | "rare" | "epique";

export interface Item {
  id: string;
  ownerId: string;
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  statBonus: Partial<HeroStats>;
  equippedByHeroId?: string;
}

export type DungeonRoomContentType = "empty" | "trap" | "monster" | "treasure";

export interface DungeonRoomCell {
  row: number;
  col: number;
  type: DungeonRoomContentType;
  /** type "trap" only: 1..N trap ids, triggered in array order when the room fires. */
  trapIds?: string[];
  /** type "monster" only: 1..N monster/boss ids fought together as one squad. */
  monsterRefIds?: string[];
}

export interface Dungeon {
  ownerId: string;
  /** Sparse: only placed cells, including the fixed entrance cell (always type "empty"). */
  rooms: DungeonRoomCell[];
  /** Owned heroes assigned to guard this dungeon; fight alongside monster-room occupants. */
  garrisonHeroIds: string[];
  /** Denormalized from `rooms` (excludes the entrance) so the target list can filter/sort cheaply. */
  roomCount: number;
  /** Denormalized count of type "treasure" rooms, 1..4. */
  treasureRoomCount: number;
  pointsSpent: number;
  updatedAt: number;
}

export interface TrapDefinition {
  id: string;
  name: string;
  description: string;
  tier: 1 | 2 | 3;
  cost: number;
  damagePercent: number;
  /** Times the trap re-triggers on repeated entry before it goes inert for the rest of the raid. */
  baseCharges: number;
}

export interface MonsterDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  isBoss?: boolean;
  stats: HeroStats;
}

export type DungeonUpgradeTrackId =
  | "expansion"
  | "architecture"
  | "defenderVigor"
  | "trapcraft"
  | "beastMastery"
  | "hazardDensity"
  | "vaultCapacity"
  | "heroSlots";

export interface DungeonUpgrades {
  ownerId: string;
  levels: Record<DungeonUpgradeTrackId, number>;
  updatedAt: number;
}

export type RaidStatus = "in_progress" | "victory" | "fled" | "wiped";

export interface RaidHeroState {
  id: string;
  name: string;
  role: Role;
  maxHp: number;
  hp: number;
  atkPhys: number;
  atkMag: number;
  defPhys: number;
  defMag: number;
  spd: number;
  /** The raid effect of this hero's first equipped spell that has one — see SpellDefinition.raidEffectTag. */
  raidEffectTag?: RaidEffectTag;
  /** True when that spell's classId matches the hero's active class — its raid effect is stronger. */
  raidEffectBonus?: boolean;
}

/** A single combatant inside a room fight: a captured monster, or a garrison hero. */
export interface DungeonOccupant {
  id: string;
  name: string;
  role?: Role;
  maxHp: number;
  hp: number;
  atkPhys: number;
  atkMag: number;
  defPhys: number;
  defMag: number;
  spd: number;
  /** Always undefined for monsters — only garrison heroes carry an equipped spell's raid effect. */
  raidEffectTag?: RaidEffectTag;
  raidEffectBonus?: boolean;
}

export interface RaidRoomState {
  visited: boolean;
  /** Monster room fought and won once, or treasure room reached. Traps are never "cleared". */
  cleared: boolean;
  /** Trap rooms only; decrements on each entry, room goes inert once it hits 0. */
  trapChargesRemaining?: number;
}

export interface RaidLogEntry {
  roomKey: string;
  kind: "trap" | "attack" | "heal" | "info";
  message: string;
  actorId?: string;
  targetId?: string;
  hpAfter?: number;
}

/**
 * Server-only raid session (Firestore: dungeonRaids/{raidId}) — never readable from the
 * client, since it holds the full dungeon layout the fog-of-war is supposed to hide.
 */
export interface DungeonRaid {
  id: string;
  attackerId: string;
  /** A real owner uid, or "bot:<botDungeonId>" for a procedurally/hand-authored dungeon. */
  defenderId: string;
  /** Layout + resolved stats/charges frozen at raid start, so mid-raid edits by the defender can't leak in. */
  defenderSnapshot: Dungeon;
  /** Combat-ready stats for each monster-room's occupants, keyed by "row,col". */
  resolvedRoomOccupants: Record<string, DungeonOccupant[]>;
  heroes: RaidHeroState[];
  currentRoom: { row: number; col: number };
  /** Keyed by "row,col" — the authoritative fog-of-war truth. */
  rooms: Record<string, RaidRoomState>;
  treasureRoomsReached: string[];
  totalLootPool: BattleReward;
  bankedLoot: BattleReward;
  status: RaidStatus;
  log: RaidLogEntry[];
  seed: string;
  startedAt: number;
  updatedAt: number;
}

/** Attacker-facing projection of a room — API response shape only, never a Firestore doc. */
export interface RaidRoomView {
  row: number;
  col: number;
  /** false = a fog tile: known to exist (adjacent to the current room) but its content is hidden. */
  known: boolean;
  visited?: boolean;
  type?: DungeonRoomContentType;
  cleared?: boolean;
  trapChargesRemaining?: number;
}

/** Attacker-facing projection of a raid — API response shape only, never a Firestore doc. */
export interface RaidView {
  raidId: string;
  status: RaidStatus;
  currentRoom: { row: number; col: number };
  rooms: RaidRoomView[];
  heroes: RaidHeroState[];
  treasureRoomsReached: number;
  treasureRoomsTotal: number;
  bankedLoot: BattleReward;
  /** Entries produced by the just-resolved move, for step-by-step playback. */
  newLog: RaidLogEntry[];
}

export interface ZoneLootTable {
  goldMin: number;
  goldMax: number;
  resourceDrops: Partial<Record<ResourceKind, [number, number]>>;
  itemDropChance: number;
  monsterCaptureChance?: number;
  monsterCaptureRefId?: string;
}

export interface ZoneDefinition {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  heroSlots: number;
  /** Length of the live arena run, in seconds. Survive it to win. */
  durationSec: number;
  /** Monster catalog ids (from lib/game/content/dungeon.ts) this zone can spawn during a run. */
  monsterPool: string[];
  /** Seconds between spawn waves. */
  spawnIntervalSec: number;
  /** Enemies spawned per wave (base count — arena engine ramps this up over time). */
  baseWaveSize: number;
  loot: ZoneLootTable;
}

/** Client-reported outcome of a live arena run, sent when claiming an expedition. */
export interface ArenaRunResult {
  survived: boolean;
  timeSurvivedMs: number;
  killCount: number;
  spawnedCount: number;
}

export type ExpeditionStatus = "active" | "claimed";

export interface Expedition {
  id: string;
  ownerId: string;
  zoneId: string;
  heroIds: string[];
  startedAt: number;
  durationSec: number;
  status: ExpeditionStatus;
}

export type ResourceKind = "wood" | "ore" | "essence";

export interface RecipeDefinition {
  id: string;
  name: string;
  profession: string;
  description: string;
  durationSec: number;
  cost: {
    gold: number;
    resources: Partial<Record<ResourceKind, number>>;
  };
  result: {
    name: string;
    slot: ItemSlot;
    rarity: ItemRarity;
    statBonus: Partial<HeroStats>;
  };
}

export interface BattleReward {
  gold: number;
  resources: Partial<Record<ResourceKind, number>>;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  gold: number;
  resources: Record<ResourceKind, number>;
  capturedMonsters?: Record<string, number>;
  crystals: number;
  /** Generic currency spent on hero star-ups (see lib/game/economy.ts rankUpCost). Gacha-granted. */
  rankTokens: number;
  /** Classes are a simple binary unlock for now — no duplicate/rank system (a dedicated class
   *  progression system is planned separately). */
  unlockedClasses: string[];
  /** Spell/talent/mastery id -> rank (1..MAX_COMPONENT_RANK). Absent/0 = not owned. A gacha
   *  duplicate raises this rank (see lib/game/economy.ts componentRankMultiplier) instead of
   *  converting to currency, until the rank cap is hit. */
  componentRanks: Record<string, number>;
  gachaPity: GachaPityState;
  createdAt: number;
}

export type GachaRarity = "commun" | "rare" | "epique" | "legendaire";

export interface GachaPityState {
  totalPulls: number;
  pullsSinceRare: number;
  pullsSinceEpique: number;
  pullsSinceLegendaire: number;
}

export type GachaRewardKind = "gold" | "monsterFragment" | "rankToken" | "class" | "spell" | "talent" | "mastery";

export interface GachaPullResult {
  rarity: GachaRarity;
  kind: GachaRewardKind;
  /** Present when kind is "class"/"spell"/"talent"/"mastery": the component id involved. */
  refId?: string;
  amount?: number;
  monsterRefId?: string;
}
