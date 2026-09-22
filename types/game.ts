// Shared domain types for the game. Player-owned documents live in Firestore
// with this shape; static game content (classes, zones, recipes...) lives in
// lib/game/content and is referenced by id from these documents.

export type Role = "DPS" | "HEAL" | "TANK";

export type HeroStatus = "idle" | "expedition" | "dungeon-guard";

export interface HeroStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface TalentNode {
  id: string;
  name: string;
  description: string;
  tier: number;
  cost: number;
  maxRank: number;
  requires?: string;
  statBonusPerRank: Partial<HeroStats>;
}

export interface SubclassDefinition {
  id: string;
  role: Role;
  name: string;
  description: string;
  strengths: string;
  weaknesses: string;
  baseStats: HeroStats;
  statGrowthPerLevel: HeroStats;
  talentTree: TalentNode[];
}

export interface Hero {
  id: string;
  ownerId: string;
  name: string;
  role: Role;
  subclassId: string;
  level: number;
  xp: number;
  talentPoints: number;
  talents: Record<string, number>;
  equipment: Partial<Record<ItemSlot, string>>;
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

export type DungeonRoomKind = "empty" | "trap" | "monster";

export interface DungeonRoomSlot {
  slot: number;
  kind: DungeonRoomKind;
  refId?: string;
}

export interface Dungeon {
  ownerId: string;
  rooms: DungeonRoomSlot[];
  bossRefId?: string;
  pointsSpent: number;
  updatedAt: number;
}

export interface TrapDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  damagePercent: number;
}

export interface MonsterDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  isBoss?: boolean;
  stats: HeroStats;
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
  durationSec: number;
  loot: ZoneLootTable;
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

export interface BattleRoundLog {
  round: number;
  roomSlot: number | "boss";
  message: string;
}

export type BattleOutcome = "victoire" | "defaite";

export interface BattleReward {
  gold: number;
  resources: Partial<Record<ResourceKind, number>>;
}

export interface BattleLog {
  id: string;
  attackerId: string;
  defenderId: string;
  outcome: BattleOutcome;
  rounds: BattleRoundLog[];
  rewards: BattleReward;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  gold: number;
  resources: Record<ResourceKind, number>;
  capturedMonsters?: Record<string, number>;
  createdAt: number;
}
