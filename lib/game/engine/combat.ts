import { createRng } from "@/lib/game/engine/rng";
import { getMonster, getTrap } from "@/lib/game/content/dungeon";
import type {
  BattleOutcome,
  BattleReward,
  BattleRoundLog,
  Dungeon,
  HeroStats,
  ResourceKind,
  Role,
} from "@/types/game";

interface CombatUnit {
  id: string;
  name: string;
  role?: Role;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface AttackingHero {
  id: string;
  name: string;
  role: Role;
  stats: HeroStats;
}

function toUnit(id: string, name: string, stats: HeroStats, role?: Role): CombatUnit {
  return { id, name, role, maxHp: stats.hp, hp: stats.hp, atk: stats.atk, def: stats.def, spd: stats.spd };
}

function damageOf(rng: () => number, attacker: CombatUnit): number {
  const base = Math.max(1, attacker.atk - 0);
  const variance = 0.85 + rng() * 0.3;
  return Math.max(1, Math.round(base * variance));
}

function pickTarget(rng: () => number, units: CombatUnit[]): CombatUnit {
  const tanks = units.filter((u) => u.role === "TANK");
  if (tanks.length > 0 && rng() < 0.7) {
    return tanks[Math.floor(rng() * tanks.length)];
  }
  return [...units].sort((a, b) => a.hp - b.hp)[0];
}

function applyDamage(target: CombatUnit, target2: CombatUnit, dmg: number) {
  const mitigated = Math.max(1, dmg - Math.round(target2.def * 0.5));
  target2.hp = Math.max(0, target2.hp - mitigated);
  return mitigated;
}

/**
 * Runs the attacking team through a single monster/boss unit until one side
 * is wiped. Mutates the attacker units' hp in place; returns whether the
 * attackers survived and the round-by-round log.
 */
function runSkirmish(
  rng: () => number,
  attackers: CombatUnit[],
  defenderUnit: CombatUnit,
  roomSlot: number | "boss",
  roundLog: BattleRoundLog[],
): boolean {
  let round = 1;
  while (attackers.some((a) => a.hp > 0) && defenderUnit.hp > 0 && round <= 30) {
    const aliveAttackers = attackers.filter((a) => a.hp > 0);
    const healer = aliveAttackers.find((a) => a.role === "HEAL");
    const damageDealers = aliveAttackers.filter((a) => a.role !== "HEAL");

    for (const attacker of damageDealers) {
      if (defenderUnit.hp <= 0) break;
      const dmg = damageOf(rng, attacker);
      const dealt = applyDamage(attacker, defenderUnit, dmg);
      roundLog.push({
        round,
        roomSlot,
        message: `${attacker.name} inflige ${dealt} dégâts à ${defenderUnit.name} (${Math.max(0, defenderUnit.hp)} PV restants).`,
      });
    }

    if (defenderUnit.hp <= 0) break;

    const target = pickTarget(rng, aliveAttackers);
    const dmg = damageOf(rng, defenderUnit);
    const dealt = applyDamage(defenderUnit, target, dmg);
    roundLog.push({
      round,
      roomSlot,
      message: `${defenderUnit.name} inflige ${dealt} dégâts à ${target.name} (${Math.max(0, target.hp)} PV restants).`,
    });

    if (healer && healer.hp > 0) {
      const lowest = [...aliveAttackers].sort((a, b) => a.hp - b.hp)[0];
      if (lowest && lowest.hp < lowest.maxHp) {
        const healAmount = Math.round(6 + healer.atk * 1.2);
        lowest.hp = Math.min(lowest.maxHp, lowest.hp + healAmount);
        roundLog.push({
          round,
          roomSlot,
          message: `${healer.name} soigne ${lowest.name} de ${healAmount} PV.`,
        });
      }
    }

    round += 1;
  }

  return attackers.some((a) => a.hp > 0) && defenderUnit.hp <= 0;
}

export interface DungeonBattleResult {
  outcome: BattleOutcome;
  rounds: BattleRoundLog[];
}

/** Simulates an asynchronous PvP attack of `attackerHeroes` against `dungeon`. Deterministic given `seed`. */
export function simulateDungeonAttack(
  attackerHeroes: AttackingHero[],
  dungeon: Dungeon,
  seed: string,
): DungeonBattleResult {
  const rng = createRng(seed);
  const rounds: BattleRoundLog[] = [];
  const units = attackerHeroes.map((h) => toUnit(h.id, h.name, h.stats, h.role));

  const orderedRooms = [...dungeon.rooms].sort((a, b) => a.slot - b.slot);

  for (const room of orderedRooms) {
    if (room.kind === "empty" || !room.refId) continue;

    if (room.kind === "trap") {
      const trap = getTrap(room.refId);
      for (const unit of units) {
        if (unit.hp <= 0) continue;
        const dmg = Math.round(unit.maxHp * trap.damagePercent);
        unit.hp = Math.max(0, unit.hp - dmg);
        rounds.push({
          round: 0,
          roomSlot: room.slot,
          message: `${trap.name} inflige ${dmg} dégâts à ${unit.name} (${unit.hp} PV restants).`,
        });
      }
      if (units.every((u) => u.hp <= 0)) {
        return { outcome: "defaite", rounds };
      }
      continue;
    }

    const monsterDef = getMonster(room.refId);
    const monsterUnit = toUnit(monsterDef.id, monsterDef.name, monsterDef.stats);
    rounds.push({
      round: 0,
      roomSlot: room.slot,
      message: `L'équipe affronte ${monsterDef.name}.`,
    });
    const survived = runSkirmish(rng, units, monsterUnit, room.slot, rounds);
    if (!survived) {
      return { outcome: "defaite", rounds };
    }
  }

  if (dungeon.bossRefId) {
    const bossDef = getMonster(dungeon.bossRefId);
    const bossUnit = toUnit(bossDef.id, bossDef.name, bossDef.stats);
    rounds.push({ round: 0, roomSlot: "boss", message: `${bossDef.name} apparaît.` });
    const survived = runSkirmish(rng, units, bossUnit, "boss", rounds);
    if (!survived) {
      return { outcome: "defaite", rounds };
    }
  }

  return { outcome: "victoire", rounds };
}

const STEAL_RATIO = 0.15;
const STEAL_CAP_GOLD = 300;

/** Computes what the attacker takes from the defender's stash after a dungeon raid. */
export function computeRaidRewards(
  outcome: BattleOutcome,
  defenderGold: number,
  defenderResources: Record<ResourceKind, number>,
): BattleReward {
  if (outcome === "defaite") {
    return { gold: 0, resources: {} };
  }

  const gold = Math.min(STEAL_CAP_GOLD, Math.round(defenderGold * STEAL_RATIO));
  const resources: Partial<Record<ResourceKind, number>> = {};
  for (const [kind, amount] of Object.entries(defenderResources) as [
    ResourceKind,
    number,
  ][]) {
    resources[kind] = Math.round(amount * STEAL_RATIO);
  }

  return { gold, resources };
}
