import "server-only";

import { GameError } from "@/lib/api/handler";
import { getMonster, getTrap } from "@/lib/game/content/dungeon";
import {
  beastMasteryMultiplierForLevel,
  garrisonStatMultiplierForLevel,
  trapExtraChargesForLevel,
  vaultCapacityMultiplierForLevel,
} from "@/lib/game/content/dungeonUpgrades";
import { resolveRoomBattle, resolveTrapTrigger } from "@/lib/game/engine/dungeonCombat";
import { ENTRANCE_CELL } from "@/lib/game/content/dungeon";
import { isAdjacent, neighborsOf, roomKey, type Cell } from "@/lib/game/engine/dungeonLayout";
import type {
  BattleReward,
  Dungeon,
  DungeonOccupant,
  DungeonRaid,
  DungeonUpgrades,
  HeroStats,
  RaidEffectTag,
  RaidLogEntry,
  RaidRoomState,
  RaidRoomView,
  RaidStatus,
  RaidView,
  ResourceKind,
  Role,
  UserProfile,
} from "@/types/game";

const STEAL_RATIO = 0.15;
const STEAL_CAP_GOLD = 300;

/** What the attacker steals from a real defender's stash, before the vaultCapacity bonus. */
export function computeLootPool(defenderProfile: UserProfile, upgrades: DungeonUpgrades): BattleReward {
  const vaultMultiplier = vaultCapacityMultiplierForLevel(upgrades.levels.vaultCapacity ?? 0);
  const gold = Math.min(STEAL_CAP_GOLD, Math.round(defenderProfile.gold * STEAL_RATIO * vaultMultiplier));
  const resources: Partial<Record<ResourceKind, number>> = {};
  for (const [kind, amount] of Object.entries(defenderProfile.resources) as [ResourceKind, number][]) {
    resources[kind] = Math.round(amount * STEAL_RATIO * vaultMultiplier);
  }
  return { gold, resources };
}

function addReward(a: BattleReward, b: BattleReward): BattleReward {
  const resources: Partial<Record<ResourceKind, number>> = { ...a.resources };
  for (const [kind, amount] of Object.entries(b.resources) as [ResourceKind, number][]) {
    resources[kind] = (resources[kind] ?? 0) + amount;
  }
  return { gold: a.gold + b.gold, resources };
}

function shareOfReward(reward: BattleReward, denominator: number): BattleReward {
  const resources: Partial<Record<ResourceKind, number>> = {};
  for (const [kind, amount] of Object.entries(reward.resources) as [ResourceKind, number][]) {
    resources[kind] = Math.round(amount / denominator);
  }
  return { gold: Math.round(reward.gold / denominator), resources };
}

export interface GarrisonMember {
  id: string;
  name: string;
  role: Role;
  stats: HeroStats;
  raidEffectTag?: RaidEffectTag;
  raidEffectBonus?: boolean;
}

export interface DefenderSnapshotResult {
  rooms: Record<string, RaidRoomState>;
  resolvedRoomOccupants: Record<string, DungeonOccupant[]>;
}

/** Resolves the dungeon's rooms into raid-ready state: trap charges and monster/garrison squads, upgrades applied. */
export function buildDefenderSnapshot(
  dungeon: Dungeon,
  upgrades: DungeonUpgrades,
  garrison: GarrisonMember[],
): DefenderSnapshotResult {
  const garrisonMultiplier = garrisonStatMultiplierForLevel(upgrades.levels.defenderVigor ?? 0);
  const beastMultiplier = beastMasteryMultiplierForLevel(upgrades.levels.beastMastery ?? 0);
  const extraCharges = trapExtraChargesForLevel(upgrades.levels.trapcraft ?? 0);

  const resolvedGarrison: DungeonOccupant[] = garrison.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role,
    maxHp: Math.round(member.stats.hp * garrisonMultiplier),
    hp: Math.round(member.stats.hp * garrisonMultiplier),
    atkPhys: Math.round(member.stats.atkPhys * garrisonMultiplier),
    atkMag: Math.round(member.stats.atkMag * garrisonMultiplier),
    defPhys: Math.round(member.stats.defPhys * garrisonMultiplier),
    defMag: Math.round(member.stats.defMag * garrisonMultiplier),
    spd: member.stats.spd,
    raidEffectTag: member.raidEffectTag,
    raidEffectBonus: member.raidEffectBonus,
  }));

  const rooms: Record<string, RaidRoomState> = {};
  const resolvedRoomOccupants: Record<string, DungeonOccupant[]> = {};

  for (const cell of dungeon.rooms) {
    const key = roomKey(cell);
    const isEntrance = cell.row === ENTRANCE_CELL.row && cell.col === ENTRANCE_CELL.col;

    if (cell.type === "trap") {
      const charges = (cell.trapIds ?? []).reduce(
        (sum, trapId) => sum + getTrap(trapId).baseCharges + extraCharges,
        0,
      );
      rooms[key] = { visited: isEntrance, cleared: isEntrance, trapChargesRemaining: charges };
    } else if (cell.type === "monster") {
      const monsterOccupants: DungeonOccupant[] = (cell.monsterRefIds ?? []).map((refId) => {
        const definition = getMonster(refId);
        const multiplier = definition.isBoss ? 1 : beastMultiplier;
        return {
          id: `${key}:${refId}`,
          name: definition.name,
          maxHp: Math.round(definition.stats.hp * multiplier),
          hp: Math.round(definition.stats.hp * multiplier),
          atkPhys: Math.round(definition.stats.atkPhys * multiplier),
          atkMag: Math.round(definition.stats.atkMag * multiplier),
          defPhys: Math.round(definition.stats.defPhys * multiplier),
          defMag: Math.round(definition.stats.defMag * multiplier),
          spd: definition.stats.spd,
        };
      });
      resolvedRoomOccupants[key] = [...monsterOccupants, ...resolvedGarrison];
      rooms[key] = { visited: isEntrance, cleared: isEntrance };
    } else {
      rooms[key] = { visited: isEntrance, cleared: isEntrance };
    }
  }

  return { rooms, resolvedRoomOccupants };
}

export function treasureRoomsTotal(raid: DungeonRaid): number {
  return raid.defenderSnapshot.rooms.filter((r) => r.type === "treasure").length;
}

export interface MoveResult {
  raid: DungeonRaid;
  newLog: RaidLogEntry[];
}

/** Resolves a single room move: trap trigger, monster fight, or treasure pickup. Server is the sole source of truth. */
export function applyMove(raid: DungeonRaid, target: Cell, rng: () => number): MoveResult {
  if (raid.status !== "in_progress") throw new GameError("Ce raid est déjà terminé");
  if (!isAdjacent(raid.currentRoom, target)) {
    throw new GameError("Cette salle n'est pas accessible depuis votre position");
  }

  const targetKey = roomKey(target);
  const cell = raid.defenderSnapshot.rooms.find((r) => r.row === target.row && r.col === target.col);
  if (!cell) throw new GameError("Cette salle n'existe pas");

  let status: RaidStatus = raid.status;
  let heroes = raid.heroes.map((h) => ({ ...h }));
  const newLog: RaidLogEntry[] = [];
  const roomState: RaidRoomState = {
    ...(raid.rooms[targetKey] ?? { visited: false, cleared: false }),
  };
  let bankedLoot = raid.bankedLoot;
  const treasureRoomsReached = [...raid.treasureRoomsReached];

  if (cell.type === "trap" && (roomState.trapChargesRemaining ?? 0) > 0) {
    for (const trapId of cell.trapIds ?? []) {
      const trap = getTrap(trapId);
      const result = resolveTrapTrigger(targetKey, heroes, trap, rng);
      heroes = result.heroesAfter;
      newLog.push(...result.log);
      if (result.wiped) {
        status = "wiped";
        break;
      }
    }
    roomState.trapChargesRemaining = Math.max(0, (roomState.trapChargesRemaining ?? 0) - 1);
  }

  if (status === "in_progress" && cell.type === "monster" && !roomState.cleared) {
    const occupants = raid.resolvedRoomOccupants[targetKey] ?? [];
    const battle = resolveRoomBattle(targetKey, heroes, occupants, rng);
    heroes = battle.heroesAfter;
    newLog.push(...battle.log);
    if (battle.outcome === "wiped") {
      status = "wiped";
    } else {
      roomState.cleared = true;
    }
  }

  if (status === "in_progress" && cell.type === "treasure" && !treasureRoomsReached.includes(targetKey)) {
    treasureRoomsReached.push(targetKey);
    roomState.cleared = true;
    const share = shareOfReward(raid.totalLootPool, treasureRoomsTotal(raid));
    bankedLoot = addReward(bankedLoot, share);
    newLog.push({
      roomKey: targetKey,
      kind: "info",
      message: "Vous découvrez une salle au trésor et sécurisez votre part du butin !",
    });
  }

  roomState.visited = true;

  const next: DungeonRaid = {
    ...raid,
    currentRoom: target,
    rooms: { ...raid.rooms, [targetKey]: roomState },
    heroes,
    treasureRoomsReached,
    bankedLoot,
    status,
    log: [...raid.log, ...newLog],
    updatedAt: Date.now(),
  };

  if (next.status === "in_progress" && treasureRoomsReached.length >= treasureRoomsTotal(raid)) {
    next.status = "victory";
  }

  return { raid: next, newLog };
}

/** What the attacker actually walks away with: the wipe rule discards banked loot entirely. */
export function finalReward(raid: DungeonRaid): BattleReward {
  if (raid.status === "wiped") return { gold: 0, resources: {} };
  return raid.bankedLoot;
}

/** Projects a raid into the attacker-facing DTO: visited rooms in full, current room's unvisited neighbors as fog, nothing else. */
export function toRaidView(raid: DungeonRaid, newLog: RaidLogEntry[] = []): RaidView {
  const cellsByKey = new Map(raid.defenderSnapshot.rooms.map((c) => [roomKey(c), c]));
  const rooms: RaidRoomView[] = [];

  for (const [key, state] of Object.entries(raid.rooms)) {
    if (!state.visited) continue;
    const cell = cellsByKey.get(key);
    if (!cell) continue;
    rooms.push({
      row: cell.row,
      col: cell.col,
      known: true,
      visited: true,
      type: cell.type,
      cleared: state.cleared,
      trapChargesRemaining: state.trapChargesRemaining,
    });
  }

  for (const neighbor of neighborsOf(raid.currentRoom)) {
    const key = roomKey(neighbor);
    if (raid.rooms[key]?.visited) continue;
    if (!cellsByKey.has(key)) continue;
    rooms.push({ row: neighbor.row, col: neighbor.col, known: true });
  }

  return {
    raidId: raid.id,
    status: raid.status,
    currentRoom: raid.currentRoom,
    rooms,
    heroes: raid.heroes,
    treasureRoomsReached: raid.treasureRoomsReached.length,
    treasureRoomsTotal: treasureRoomsTotal(raid),
    bankedLoot: raid.bankedLoot,
    newLog,
  };
}
