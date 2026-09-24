import "server-only";

import { GameError } from "@/lib/api/handler";
import { getMonster, getTrap, monsterScaleForDefenseLevel } from "@/lib/game/content/dungeon";
import {
  beastMasteryMultiplierForLevel,
  garrisonStatMultiplierForLevel,
  vaultStealMultiplierForLevel,
  wardResistanceForLevel,
} from "@/lib/game/content/dungeonUpgrades";
import { partyDisarm, resolveMarchHeal, resolveRoomBattle, resolveTrapTrigger } from "@/lib/game/engine/dungeonCombat";
import { ELEMENTS, resistancesOf } from "@/lib/game/engine/elements";
import { ENTRANCE_CELL } from "@/lib/game/content/dungeon";
import { isAdjacent, neighborsOf, roomKey, type Cell } from "@/lib/game/engine/dungeonLayout";
import type {
  BattleReward,
  Dungeon,
  DungeonOccupant,
  DungeonRaid,
  DungeonUpgrades,
  Element,
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
/** A stronger dungeon guards a bigger purse: the gold cap grows with its defense level. */
const STEAL_CAP_GOLD_PER_DEFENSE_LEVEL = 15;

/** What the attacker can steal from a real defender's stash, reduced by the defender's Coffre-fort. */
export function computeLootPool(defenderProfile: UserProfile, upgrades: DungeonUpgrades, defenseLevel = 1): BattleReward {
  const vaultMultiplier = vaultStealMultiplierForLevel(upgrades.levels.vaultCapacity ?? 0);
  const cap = STEAL_CAP_GOLD + STEAL_CAP_GOLD_PER_DEFENSE_LEVEL * Math.max(0, defenseLevel - 1);
  const gold = Math.min(cap, Math.round(defenderProfile.gold * STEAL_RATIO * vaultMultiplier));
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

/** A stat block's resistances plus the Sceaux élémentaires bonus on every element. */
function wardedResistances(stats: Partial<HeroStats>, ward: number): Partial<Record<Element, number>> {
  const res = resistancesOf(stats);
  if (ward <= 0) return res;
  for (const element of ELEMENTS) res[element] = (res[element] ?? 0) + ward;
  return res;
}

export interface GarrisonMember {
  id: string;
  name: string;
  role: Role;
  stats: HeroStats;
  raidEffectTag?: RaidEffectTag;
  raidEffectBonus?: boolean;
  element?: Element;
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
  // Monsters grow with their owner: the dungeon's defense level scales every monster (bosses included).
  const levelMultiplier = monsterScaleForDefenseLevel(dungeon.defenseLevel);
  const ward = wardResistanceForLevel(upgrades.levels.elementalWards ?? 0);

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
    crit: member.stats.crit,
    critDmg: member.stats.critDmg,
    element: member.element,
    res: wardedResistances(member.stats, ward),
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
        (sum, trapId) => sum + getTrap(trapId).baseCharges,
        0,
      );
      rooms[key] = { visited: isEntrance, cleared: isEntrance, trapChargesRemaining: charges };
    } else if (cell.type === "monster") {
      const monsterOccupants: DungeonOccupant[] = (cell.monsterRefIds ?? []).map((refId) => {
        const definition = getMonster(refId);
        const multiplier = levelMultiplier * (definition.isBoss ? 1 : beastMultiplier);
        return {
          id: `${key}:${refId}`,
          name: definition.name,
          maxHp: Math.round(definition.stats.hp * multiplier),
          hp: Math.round(definition.stats.hp * multiplier),
          atkPhys: Math.round(definition.stats.atkPhys * multiplier),
          atkMag: Math.round(definition.stats.atkMag * multiplier),
          defPhys: Math.round(definition.stats.defPhys * multiplier),
          defMag: Math.round(definition.stats.defMag * multiplier),
          spd: Math.round(definition.stats.spd * Math.sqrt(levelMultiplier)),
          crit: definition.stats.crit,
          critDmg: definition.stats.critDmg,
          element: definition.element,
          res: wardedResistances(definition.stats, ward),
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
    const disarm = partyDisarm(heroes);
    if (disarm > 0) {
      newLog.push({ roomKey: targetKey, kind: "info", message: `L'équipe repère les mécanismes : dégâts des pièges réduits de ${Math.round(disarm * 100)} %.` });
    }
    const roomBudget = new Map<string, number>();
    for (const [stackIndex, trapId] of (cell.trapIds ?? []).entries()) {
      const trap = getTrap(trapId);
      const result = resolveTrapTrigger(targetKey, heroes, trap, rng, stackIndex, disarm, raid.trapDamageMultiplier ?? 1, roomBudget);
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

  // Healers patch the party up after any room that hurt (trap fired or fight fought).
  const dangerous = (cell.type === "trap" && newLog.some((l) => l.kind === "trap")) || (cell.type === "monster" && newLog.some((l) => l.kind === "attack"));
  if (status === "in_progress" && dangerous) {
    const heal = resolveMarchHeal(targetKey, heroes);
    heroes = heal.heroesAfter;
    newLog.push(...heal.log);
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

  // A living "scout" hero reveals what the fog tiles next to the party contain (and, with its class
  // bonus, how many traps/monsters wait there).
  const scout = raid.heroes.filter((h) => h.hp > 0 && h.raidEffectTag === "scout");
  const scoutBonus = scout.some((h) => h.raidEffectBonus);
  for (const neighbor of neighborsOf(raid.currentRoom)) {
    const key = roomKey(neighbor);
    if (raid.rooms[key]?.visited) continue;
    const cell = cellsByKey.get(key);
    if (!cell) continue;
    if (scout.length === 0) {
      rooms.push({ row: neighbor.row, col: neighbor.col, known: true });
      continue;
    }
    rooms.push({
      row: neighbor.row,
      col: neighbor.col,
      known: true,
      scouted: true,
      type: cell.type,
      occupantCount: scoutBonus ? (cell.trapIds?.length ?? cell.monsterRefIds?.length) : undefined,
    });
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
