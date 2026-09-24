// Pure, stateless dungeon-raid combat math: no Firestore, no request/response
// shapes. Distinct from lib/game/engine/combat.ts (the old one-shot whole-dungeon
// simulator, being removed) and from lib/game/arena/engine.ts (the real-time,
// client-stepped expedition mini-game) — this resolves exactly one room per call,
// symmetrically: both the attacking party and the room's occupants (monsters
// and/or garrison heroes) act every round, using the same role-aware rules.
//
// A unit's equipped spell (RaidHeroState.raidEffectTag / DungeonOccupant.raidEffectTag,
// see SpellDefinition) modifies its attack this fight: splash damage to a second
// target, bonus damage vs a weakened target, defense-piercing, a stun, lifesteal,
// bonus "poison" damage, a shield against the next hit taken, or — HEAL-role units
// only — a boosted per-round heal instead of attacking at all. A spell works
// regardless of the caster's class; matching the spell's own class (raidEffectBonus)
// just makes the effect stronger — see RAID_MAGNITUDE below.

import type { DungeonOccupant, RaidEffectTag, RaidHeroState, RaidLogEntry, Role, TrapDefinition } from "@/types/game";

export type RoomOccupant = DungeonOccupant;

const MAX_ROUNDS = 30;

/** Per-tag effect magnitude, stronger when the spell's class matches the caster's active class
 *  (RaidHeroState.raidEffectBonus / DungeonOccupant.raidEffectBonus). Spells work at `base`
 *  magnitude regardless of class — the class match is a bonus, not a requirement. */
const RAID_MAGNITUDE: Record<RaidEffectTag, { base: number; bonus: number }> = {
  cleave: { base: 0.3, bonus: 0.45 }, // splash damage, as a ratio of the hit's mitigated damage
  execute: { base: 1.5, bonus: 1.75 }, // damage multiplier vs a target below 30% HP
  pierce: { base: 0.5, bonus: 0.7 }, // defense ignored, as a ratio
  poison: { base: 1.25, bonus: 1.45 }, // damage multiplier
  lifesteal: { base: 0.4, bonus: 0.55 }, // heal, as a ratio of mitigated damage dealt
  shield: { base: 0.3, bonus: 0.45 }, // damage reduction on the next hit taken, as a ratio
  stun: { base: 1, bonus: 1 }, // binary — no magnitude to scale
  heal: { base: 1.5, bonus: 1.8 }, // per-round heal multiplier
};

function magnitude(tag: RaidEffectTag, bonus: boolean): number {
  return bonus ? RAID_MAGNITUDE[tag].bonus : RAID_MAGNITUDE[tag].base;
}

function damageOf(rng: () => number, atk: number): number {
  const variance = 0.85 + rng() * 0.3;
  return Math.max(1, Math.round(atk * variance));
}

function pickTarget<T extends { role?: Role; hp: number }>(rng: () => number, units: T[]): T {
  const tanks = units.filter((u) => u.role === "TANK");
  if (tanks.length > 0 && rng() < 0.7) {
    return tanks[Math.floor(rng() * tanks.length)];
  }
  return [...units].sort((a, b) => a.hp - b.hp)[0];
}

/** A unit's attack is whichever of atkPhys/atkMag is higher — that's the damage type it deals this fight. */
function attackPower(actor: { atkPhys: number; atkMag: number }): { value: number; type: "phys" | "mag" } {
  return actor.atkPhys >= actor.atkMag
    ? { value: actor.atkPhys, type: "phys" }
    : { value: actor.atkMag, type: "mag" };
}

/** Effect state that persists across rounds within a single room fight (stuns/shields are consumed on next use). */
interface EffectState {
  stunned: Set<string>;
  shielded: Map<string, number>;
}

function runSide<A extends RoomOccupant, D extends RoomOccupant>(
  rng: () => number,
  roomKey: string,
  actingSide: A[],
  targetSide: D[],
  log: RaidLogEntry[],
  effect: EffectState,
) {
  const alive = actingSide.filter((u) => u.hp > 0);
  const healer = alive.find((u) => u.role === "HEAL" && u.raidEffectTag === "heal");
  const attackers = alive.filter((u) => u !== healer);

  for (const actor of attackers) {
    if (effect.stunned.has(actor.id)) {
      effect.stunned.delete(actor.id);
      log.push({
        roomKey,
        kind: "info",
        message: `${actor.name} est étourdi et ne peut agir.`,
        actorId: actor.id,
      });
      continue;
    }

    const aliveTargets = targetSide.filter((u) => u.hp > 0);
    if (aliveTargets.length === 0) break;
    const target = pickTarget(rng, aliveTargets);
    const { value, type } = attackPower(actor);
    const tag = actor.raidEffectTag;
    const bonus = !!actor.raidEffectBonus;

    let rawDamage = damageOf(rng, value);
    if (tag === "execute" && target.hp / target.maxHp < 0.3) rawDamage = Math.round(rawDamage * magnitude(tag, bonus));
    if (tag === "poison") rawDamage = Math.round(rawDamage * magnitude(tag, bonus));

    const rawDef = type === "phys" ? target.defPhys : target.defMag;
    const effectiveDef = tag === "pierce" ? rawDef * (1 - magnitude(tag, bonus)) : rawDef;
    let mitigated = Math.max(1, rawDamage - Math.round(effectiveDef * 0.5));

    const shieldReduction = effect.shielded.get(target.id);
    if (shieldReduction) {
      mitigated = Math.max(1, Math.round(mitigated * (1 - shieldReduction)));
      effect.shielded.delete(target.id);
    }

    target.hp = Math.max(0, target.hp - mitigated);
    log.push({
      roomKey,
      kind: "attack",
      message: `${actor.name} inflige ${mitigated} dégâts à ${target.name} (${target.hp} PV restants).`,
      actorId: actor.id,
      targetId: target.id,
      hpAfter: target.hp,
    });

    if (tag === "cleave") {
      const others = targetSide.filter((u) => u.hp > 0 && u.id !== target.id);
      if (others.length > 0) {
        const splash = others[Math.floor(rng() * others.length)];
        const splashDmg = Math.max(1, Math.round(mitigated * magnitude(tag, bonus)));
        splash.hp = Math.max(0, splash.hp - splashDmg);
        log.push({
          roomKey,
          kind: "attack",
          message: `L'onde de ${actor.name} touche aussi ${splash.name} (${splashDmg} dégâts).`,
          actorId: actor.id,
          targetId: splash.id,
          hpAfter: splash.hp,
        });
      }
    } else if (tag === "lifesteal") {
      const healAmount = Math.round(mitigated * magnitude(tag, bonus));
      actor.hp = Math.min(actor.maxHp, actor.hp + healAmount);
      log.push({
        roomKey,
        kind: "heal",
        message: `${actor.name} se régénère de ${healAmount} PV.`,
        actorId: actor.id,
        hpAfter: actor.hp,
      });
    } else if (tag === "stun") {
      effect.stunned.add(target.id);
    } else if (tag === "shield") {
      effect.shielded.set(actor.id, magnitude(tag, bonus));
    }
  }

  if (healer && healer.hp > 0) {
    const lowest = [...alive].sort((a, b) => a.hp - b.hp)[0];
    if (lowest && lowest.hp < lowest.maxHp) {
      const healMultiplier = magnitude("heal", !!healer.raidEffectBonus);
      const healAmount = Math.round((6 + Math.max(healer.atkPhys, healer.atkMag) * 1.2) * healMultiplier);
      lowest.hp = Math.min(lowest.maxHp, lowest.hp + healAmount);
      log.push({
        roomKey,
        kind: "heal",
        message: `${healer.name} soigne ${lowest.name} de ${healAmount} PV.`,
        actorId: healer.id,
        targetId: lowest.id,
        hpAfter: lowest.hp,
      });
    }
  }
}

export interface RoomBattleResult {
  outcome: "cleared" | "wiped";
  heroesAfter: RaidHeroState[];
  log: RaidLogEntry[];
}

/** Runs the attacking heroes against a room's occupants (monsters and/or garrison heroes) until one side is wiped. */
export function resolveRoomBattle(
  roomKey: string,
  heroes: RaidHeroState[],
  defenders: RoomOccupant[],
  rng: () => number,
): RoomBattleResult {
  const attackers = heroes.map((h) => ({ ...h }));
  const room = defenders.map((d) => ({ ...d }));
  const log: RaidLogEntry[] = [];
  const effect: EffectState = { stunned: new Set(), shielded: new Map() };

  let round = 1;
  while (
    attackers.some((a) => a.hp > 0) &&
    room.some((d) => d.hp > 0) &&
    round <= MAX_ROUNDS
  ) {
    runSide(rng, roomKey, attackers, room, log, effect);
    if (room.every((d) => d.hp <= 0)) break;
    runSide(rng, roomKey, room, attackers, log, effect);
    round += 1;
  }

  const cleared = room.every((d) => d.hp <= 0) && attackers.some((a) => a.hp > 0);
  return {
    outcome: cleared ? "cleared" : "wiped",
    heroesAfter: attackers,
    log,
  };
}

export interface TrapTriggerResult {
  heroesAfter: RaidHeroState[];
  log: RaidLogEntry[];
  wiped: boolean;
}

/** Applies a trap's damage (a % of max HP) to the whole attacking team. */
export function resolveTrapTrigger(
  roomKey: string,
  heroes: RaidHeroState[],
  trap: TrapDefinition,
  rng: () => number,
): TrapTriggerResult {
  const heroesAfter = heroes.map((h) => ({ ...h }));
  const log: RaidLogEntry[] = [];

  for (const hero of heroesAfter) {
    if (hero.hp <= 0) continue;
    const variance = 0.9 + rng() * 0.2;
    const dmg = Math.max(1, Math.round(hero.maxHp * trap.damagePercent * variance));
    hero.hp = Math.max(0, hero.hp - dmg);
    log.push({
      roomKey,
      kind: "trap",
      message: `${trap.name} inflige ${dmg} dégâts à ${hero.name} (${hero.hp} PV restants).`,
      targetId: hero.id,
      hpAfter: hero.hp,
    });
  }

  return { heroesAfter, log, wiped: heroesAfter.every((h) => h.hp <= 0) };
}
