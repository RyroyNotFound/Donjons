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
  /** Critical hit chance, in % (capped at combat time, see lib/game/engine/elements.ts). */
  crit: number;
  /** Extra damage on a critical hit, in % (50 = a crit deals x1.5). */
  critDmg: number;
  /** Elemental resistances, in % — negative = weakness. Capped at combat time. */
  resFeu: number;
  resGlace: number;
  resFoudre: number;
  resSacre: number;
  resOmbre: number;
  /** Reduction of dungeon-trap damage taken, in % (capped). Useless in expeditions — a raid-prep stat. */
  trapRes: number;
}

/** Damage element. A hero's attacks carry the element of its first equipped elemental spell
 *  ("affinité", see heroElement in lib/game/engine/stats.ts); a monster's carry its own.
 *  Unset = neutral: no resistance applies. */
export type Element = "feu" | "glace" | "foudre" | "sacre" | "ombre";

/** Expedition difficulty tier (see lib/game/content/difficulties.ts). */
export type Difficulty = "normal" | "difficile" | "cauchemar" | "tourment";

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
  /** The node this one follows in the tree — display only: it no longer gates spending, since
   *  nodes come from random gacha pulls and a missing prerequisite would lock them forever. */
  requires?: string;
  /** Minimum hero star rank needed to unlock this node, in addition to `requires`. */
  requiresStarRank?: number;
  statBonusPerRank: Partial<HeroStats>;
}

export type ArenaAbilityTag =
  | "cleave"
  | "multishot"
  | "regen"
  | "haste"
  | "dmgbuff"
  | "lifesteal"
  | "nova"
  | "chain"
  | "meteor"
  | "barrier"
  | "venom"
  | "execute";

/** How a spell modifies its owner's attack during turn-based dungeon-raid combat
 *  (lib/game/engine/dungeonCombat.ts): splash damage to a second target, bonus damage
 *  vs a weakened target, defense-piercing, a stun, self-healing on hit, bonus damage
 *  framed as poison, a shield against the next hit taken, or (HEAL-role units only) a
 *  boosted per-round heal instead of attacking. Two are party-wide utilities instead of a combat
 *  effect (the hero then attacks plainly): "disarm" cuts the whole party's trap damage, "scout"
 *  reveals what is inside the rooms next to the party (see lib/game/engine/dungeonRaid.ts). */
export type RaidEffectTag =
  | "cleave"
  | "execute"
  | "pierce"
  | "stun"
  | "lifesteal"
  | "poison"
  | "shield"
  | "heal"
  | "disarm"
  | "scout";

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
  /** Element this spell carries — the first equipped elemental spell sets the element of all
   *  the hero's attacks. Undefined = neutral. */
  element?: Element;
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
  /** Missing stats = 0. Crit/critDmg should include the BASE_CRIT/BASE_CRIT_DMG baseline. */
  baseStats: Partial<HeroStats>;
  statGrowthPerLevel: Partial<HeroStats>;
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
  /** Legacy per-hero ensembles, from before they were shared by the account (UserProfile.builds).
   *  Kept untouched; only read to seed the shared list (see lib/game/builds.ts). */
  builds: HeroBuild[];
  status: HeroStatus;
  createdAt: number;
}

export type ItemSlot = "weapon" | "armor" | "trinket";
export type ItemRarity = "commun" | "rare" | "epique" | "legendaire";

/** A random bonus line rolled onto an item (see lib/game/content/affixes.ts). Stores the rolled
 *  values so later content rebalancing never silently changes an existing item. */
export interface ItemAffix {
  affixId: string;
  statBonus: Partial<HeroStats>;
}

export interface Item {
  id: string;
  ownerId: string;
  /** Display name, including the first affix suffix ("Épée en fer du Colosse"). */
  name: string;
  /** Name without affix suffix — kept so reforging can rename the item. Absent on old items (= name). */
  baseName?: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  /** Base (implicit) stats, before affixes and enhancement. */
  statBonus: Partial<HeroStats>;
  /** Random bonus lines — count depends on rarity. Absent on items made before affixes existed. */
  affixes?: ItemAffix[];
  /** Forge enhancement level, 0..MAX_ENHANCE_LEVEL (see lib/game/engine/items.ts). Absent = 0. */
  enhanceLevel?: number;
  /** 1..5 (4-5 only from harder expedition difficulties): drives affix value ranges and salvage yield. Absent = 1. */
  tier?: number;
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
  /** Strength of the dungeon's monsters (see monsterScaleForDefenseLevel): the average level of the
   *  owner's 4 best heroes when the layout was saved. Absent on dungeons saved before it existed (= 1). */
  defenseLevel?: number;
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
  /** Element of the trap's damage — reduced by the matching resistance on top of trapRes. Undefined = neutral. */
  element?: Element;
}

export interface MonsterDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  isBoss?: boolean;
  /** Includes the monster's resistances (resFeu...) — negative values are weaknesses. */
  stats: HeroStats;
  /** Element of this monster's attacks. Undefined = neutral. */
  element?: Element;
}

export type DungeonUpgradeTrackId =
  | "expansion"
  | "architecture"
  | "defenderVigor"
  | "trapcraft"
  | "beastMastery"
  | "hazardDensity"
  | "vaultCapacity"
  | "elementalWards"
  /** Not shown among dungeon tracks: hero roster slots, bought with gold from the Héros page. */
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
  /** Crit/element/trap fields are absent on raids started before they existed (= 0 / neutral). */
  trapRes?: number;
  /** "Affaibli" stacks (0..MAX_WEAKENED) from traps that hit hard: the next fight is harder. Cleared by it. */
  weakened?: number;
  crit?: number;
  critDmg?: number;
  element?: Element;
  res?: Partial<Record<Element, number>>;
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
  crit?: number;
  critDmg?: number;
  element?: Element;
  res?: Partial<Record<Element, number>>;
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
  /** Real defender: the stash share that can be stolen, split across the treasure rooms. Bot: the
   *  loot found in EACH treasure room. */
  totalLootPool: BattleReward;
  /** Loot taken from the defender so far (debited from a real defender when the raid ends). */
  bankedLoot: BattleReward;
  /** Created loot banked so far (treasureRoomBonus per treasure room vs a real player) — paid to the
   *  attacker, never debited. Absent on older raids = none. */
  bankedBonus?: BattleReward;
  /** Defender's Trapcraft damage bonus frozen at raid start (absent on older raids = 1). */
  trapDamageMultiplier?: number;
  status: RaidStatus;
  log: RaidLogEntry[];
  seed: string;
  /** Attacker display info for the defender's journal (absent on raids started before it existed). */
  attackerName?: string;
  attackerLevel?: number;
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
  /** Fog tile revealed by a "scout" hero: `type` is filled in without the room being visited. */
  scouted?: boolean;
  /** Scouted with the class bonus: how many traps/monsters the room holds. */
  occupantCount?: number;
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
  /** Set on the response of the move/flee that ended the raid: crystals the attacker earned. */
  crystalsEarned?: number;
  /** Set on the response of the move that conquered the dungeon (see rollConquestBounty). */
  bounty?: { gold: number; forgeShards: number; item: Pick<Item, "name" | "rarity" | "slot" | "tier"> };
}

export interface ZoneLootTable {
  goldMin: number;
  goldMax: number;
  resourceDrops: Partial<Record<ResourceKind, [number, number]>>;
  itemDropChance: number;
  monsterCaptureChance?: number;
  monsterCaptureRefId?: string;
}

/** The zone's end-of-run boss: a monster from the catalog, scaled up. Spawns at `spawnAtSec`;
 *  killing it ends the run early as a victory. */
export interface ZoneBoss {
  refId: string;
  name: string;
  hpMultiplier: number;
  atkMultiplier: number;
  spawnAtSec: number;
}

/** Telegraphed ground strikes aimed at a hero's current spot: harmless to a moving party, lethal to
 *  one that stands still. Percent of max HP, so defense doesn't cancel them and difficulty doesn't
 *  scale them. */
export interface ZoneHazard {
  name: string;
  /** Fraction of each hit hero's max HP. */
  damagePct: number;
  intervalSec: number;
}

export interface ZoneDefinition {
  id: string;
  name: string;
  description: string;
  /** Order in the expedition ladder (1 = first zone). */
  tier: number;
  /** Zone that must be cleared (≥1★) before this one unlocks. Undefined = unlocked from the start. */
  unlockRequires?: string;
  /** Loot/item-tier scale (see lib/game/engine/loot.ts). */
  difficulty: number;
  /** Team power (see heroPower in lib/game/engine/stats.ts) at which the zone is comfortable. */
  recommendedPower: number;
  heroSlots: number;
  /** Length of the live arena run, in seconds (90..120; monsters toughen over time, see timeRamp). */
  durationSec: number;
  /** Monster catalog ids (from lib/game/content/dungeon.ts) this zone can spawn during a run. */
  monsterPool: string[];
  /** Multiplier on every spawned monster's stats. */
  statScale: number;
  /** Seconds between spawn waves. */
  spawnIntervalSec: number;
  /** Enemies spawned in the first wave (ramps up over time, see waveSize in lib/game/arena/engine.ts). */
  baseWaveSize: number;
  /** An elite (tougher, more XP) joins every Nth wave. */
  eliteEveryNWaves: number;
  boss: ZoneBoss;
  /** Anti-idle pressure for zones whose monsters are too weak to punish standing still on their own. */
  hazard?: ZoneHazard;
  /** Hero XP for a full clear (scaled down on defeat). */
  xpReward: number;
  /** Arena background gradient (inner, outer). */
  theme: { inner: string; outer: string };
  loot: ZoneLootTable;
}

/** Client-reported outcome of a live arena run, sent when claiming an expedition. Validated
 *  server-side against the zone's deterministic spawn schedule (see lib/game/arena/engine.ts). */
export interface ArenaRunResult {
  survived: boolean;
  timeSurvivedMs: number;
  killCount: number;
  bossKilled: boolean;
  /** Heroes knocked out during the run (3★ requires 0). */
  heroesKo: number;
  /** In-run level reached (from XP gems). */
  levelReached: number;
}

/** Per-zone expedition progress on a profile. */
export interface ExpeditionRecord {
  bestStars: number;
  clears: number;
  /** UTC day ("YYYY-MM-DD") the zone's daily first-victory bonus was last paid. Only set on the
   *  zone's normal-difficulty record: the bonus is per zone, whatever the difficulty. */
  dailyBonusDay?: string;
}

export type LeaderboardCategory = "power" | "expeditions" | "raids" | "collection";

export interface LeaderboardEntry {
  rank: number;
  uid: string;
  displayName: string;
  score: number;
  /** Human-readable breakdown shown under the score. */
  detail: string;
}

/** GET /api/leaderboard payload (built in lib/game/leaderboard.ts). */
export interface LeaderboardResponse {
  categories: Record<LeaderboardCategory, { top: LeaderboardEntry[]; me: LeaderboardEntry | null }>;
  playerCount: number;
  builtAt: number;
}

/** Lifetime raid counters, bumped in lib/game/dungeonRaidLifecycle.ts. Feeds the leaderboard. */
export interface RaidStats {
  /** Raids won (every room cleared) against a real player's dungeon. */
  pvpWins: number;
  /** Raids won against a developer-made "bot" dungeon. */
  botWins: number;
  /** Raids against this player's own dungeon that ended with the attacker wiped. */
  defenseWins: number;
  /** Gold + resources carried home from real players' dungeons (victory or flee). */
  lootStolen: number;
}

export type ExpeditionStatus = "active" | "claimed";

export interface Expedition {
  id: string;
  ownerId: string;
  zoneId: string;
  heroIds: string[];
  /** Absent on expeditions started before difficulties existed (= "normal"). */
  difficulty?: Difficulty;
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
  /** 1..3: higher tiers roll better rarities and stronger affixes (see lib/game/engine/items.ts). */
  tier: number;
  result: {
    name: string;
    slot: ItemSlot;
    /** Base stats at "commun" — the rolled rarity scales them up. */
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
  /** Uniqueness key of the chosen name (see lib/game/playerName.ts), reserved in `displayNames/{key}`.
   *  Absent = still on the auto-generated "Aventurier-xxxxx" name. */
  displayNameKey?: string;
  /** Set once the first-login intro (lore + presentation + name choice) is done. Absent = show it. */
  onboardedAt?: number;
  gold: number;
  resources: Record<ResourceKind, number>;
  capturedMonsters?: Record<string, number>;
  crystals: number;
  /** Generic currency spent on hero star-ups (see lib/game/economy.ts rankUpCost). Gacha-granted. */
  rankTokens: number;
  /** Forge material earned by salvaging items, spent on enhancing/reforging them. Absent = 0. */
  forgeShards?: number;
  /** Gacha by-product (every pull gives some), spent at the Observatoire to pick a specific
   *  spell/talent/mastery/class or rank one up (see lib/game/content/observatory.ts). Absent = 0. */
  stardust?: number;
  /** Bot dungeon id -> victories, for the first-win crystal bonus. Absent = none yet. */
  botDungeonWins?: Record<string, number>;
  /** Record key (see recordKey in lib/game/content/difficulties.ts: the zone id for normal,
   *  "zoneId:difficulty" otherwise) -> best stars and clear count. Absent = no zone cleared yet. */
  expeditionRecords?: Record<string, ExpeditionRecord>;
  /** Absent = no raid finished yet (every counter 0). */
  raidStats?: RaidStats;
  /** Absent = tavern never visited. */
  tavern?: TavernState;
  /** Defender id -> UTC day ("YYYY-MM-DD") of the last conquest that paid crystals (once a day per dungeon). */
  raidConquests?: Record<string, string>;
  /** Latest raids against this player's dungeon, newest first (capped, see DEFENSE_LOG_SIZE). */
  defenseLog?: DefenseLogEntry[];
  /** Classes are a simple binary unlock for now — no duplicate/rank system (a dedicated class
   *  progression system is planned separately). */
  unlockedClasses: string[];
  /** Spell/talent/mastery id -> rank (1..MAX_COMPONENT_RANK). Absent/0 = not owned. A gacha
   *  duplicate raises this rank (see lib/game/economy.ts componentRankMultiplier) instead of
   *  converting to currency, until the rank cap is hit. */
  componentRanks: Record<string, number>;
  /** Ensembles shared by all the account's heroes. Absent = never saved since they became shared:
   *  the heroes' old per-hero lists stand in (see sharedBuilds in lib/game/builds.ts). */
  builds?: HeroBuild[];
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
  /** Stardust this pull granted on top of its reward (see STARDUST_PER_PULL). */
  stardust?: number;
}

export type TavernNpcKind = "marchand" | "conteur" | "bienfaiteur" | "parieur";
/** How often an NPC shows up in the rotation (see lib/game/tavern.ts NPC_RARITY_WEIGHT). */
export type TavernNpcRarity = "commun" | "rare" | "legendaire";

export interface TavernAmount {
  gold?: number;
  crystals?: number;
  rankTokens?: number;
  forgeShards?: number;
  resources?: Partial<Record<ResourceKind, number>>;
}

export interface TavernReward extends TavernAmount {
  /** A freshly rolled item from this recipe's base. `rarity` forces the rarity; absent = the
   *  recipe tier's craft odds. */
  item?: { recipeId: string; rarity?: ItemRarity };
  /** A rolled item from a random recipe, with random rarity (see RANDOM_ITEM_RARITY_WEIGHTS). */
  randomItem?: boolean;
  /** Client-only joke purchase: the id of the interface theme the player asked for (they get a
   *  different one, and it wears off when leaving the page). Nothing is persisted. */
  cosmeticThemeId?: string;
}

/** One thing an NPC offers: a purchase (marchand), a gift (bienfaiteur) or a bet (parieur). */
export interface TavernOffer {
  id: string;
  label: string;
  description?: string;
  cost?: TavernAmount;
  reward: TavernReward;
  /** Bets only: 0..1 chance that the reward is granted (the cost is always paid). */
  winChance?: number;
  /** The price is a secret random amount of gold between 1 and everything the player owns,
   *  rolled server-side when the offer is taken. */
  randomGoldCost?: boolean;
}

/** A tavern NPC (static content, lib/game/content/tavern.ts). */
export interface TavernNpc {
  id: string;
  name: string;
  title: string;
  /** Emoji portrait. */
  portrait: string;
  kind: TavernNpcKind;
  rarity: TavernNpcRarity;
  greeting: string;
  /** Storytellers: the tale, one paragraph per entry. */
  story?: string[];
  offers?: TavernOffer[];
  /** "each" (default): every offer can be taken once per visit. "pickOne": taking one closes the others. */
  offerMode?: "each" | "pickOne";
  /** Bets only: lines shown on a won/lost bet. */
  winLine?: string;
  loseLine?: string;
  /** Storytellers: the tale never ends — past the last paragraph it starts over. */
  storyLoops?: boolean;
}

/** Per-profile tavern progress. `slot` is the 30-min rotation window the claims belong to —
 *  a different current slot means a new NPC and a fresh `claimedOfferIds`. */
export interface TavernState {
  slot: number;
  claimedOfferIds: string[];
  /** Every NPC ever met (codex). */
  metNpcIds: string[];
}

/** One raid against a player's dungeon, as shown in its owner's defense journal. */
export interface DefenseLogEntry {
  at: number;
  attackerName: string;
  attackerLevel: number;
  /** defended = attacker wiped · fled = attacker left with part of the loot · conquered = every treasure room reached. */
  result: "defended" | "fled" | "conquered";
  treasureReached: number;
  treasureTotal: number;
  goldLost: number;
  /** Deepest room the attacker died in, when defended ("row,col"). */
  fellIn?: string;
  crystalsGained: number;
}
