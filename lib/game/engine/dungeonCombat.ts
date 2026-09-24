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
//
// Every hit can crit (the actor's crit/critDmg) and carries the actor's element (a hero's
// first equipped elemental spell, a monster's own), scaled by the target's resistance to it.

import { critChance, critMultiplier, elementalMultiplier, MAX_TRAP_RESISTANCE } from "@/lib/game/engine/elements";
import { TRAP_STACK_FALLOFF } from "@/lib/game/content/dungeon";
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
  disarm: { base: 0.35, bonus: 0.5 }, // party-wide trap damage reduction (strongest disarmer counts)
  scout: { base: 1, bonus: 1 }, // map utility, handled by the raid view — no combat effect
};

/** Party-wide trap damage reduction from its best "disarm" hero (0 = none). */
export function partyDisarm(heroes: Pick<RaidHeroState, "hp" | "raidEffectTag" | "raidEffectBonus">[]): number {
  let best = 0;
  for (const h of heroes) {
    if (h.hp > 0 && h.raidEffectTag === "disarm") best = Math.max(best, magnitude("disarm", !!h.raidEffectBonus));
  }
  return best;
}

/** Trap → fight synergy: a hero hit by a trap for at least WEAKEN_THRESHOLD of its max HP gains an
 *  "Affaibli" stack (max MAX_WEAKENED). In its next fight each stack cuts its damage and raises the
 *  damage it takes by WEAKEN_PER_STACK; the fight then clears them. Trap resistance and disarm keep
 *  hits under the threshold (healers only restore HP) — so a dungeon mixing traps and
 *  monsters is worth more than the sum of its rooms. */
export const WEAKEN_THRESHOLD = 0.08;
export const MAX_WEAKENED = 2;
export const WEAKEN_PER_STACK = 0.2;

/** Traps wear a party down, monsters finish it: one trap room can take at most this share of a hero's
 *  max HP (before trapRes/element/disarm reductions, so counters still matter in heavy rooms), and a
 *  trap never kills — it leaves at least 1 HP. */
export const TRAP_ROOM_DAMAGE_CAP = 0.28;

/** Share of max HP every living HEAL-role hero restores to the party after each dangerous room. */
const MARCH_HEAL = 0.06;
const MARCH_HEAL_WITH_HEAL_SPELL = 0.1;

/** Out-of-combat healing between rooms: each living healer patches the whole party up a bit. */
export function resolveMarchHeal(roomKey: string, heroes: RaidHeroState[]): { heroesAfter: RaidHeroState[]; log: RaidLogEntry[] } {
  const heroesAfter = heroes.map((h) => ({ ...h }));
  const healers = heroesAfter.filter((h) => h.hp > 0 && h.role === "HEAL");
  if (healers.length === 0) return { heroesAfter, log: [] };
  const share = healers.reduce((s, h) => s + (h.raidEffectTag === "heal" ? MARCH_HEAL_WITH_HEAL_SPELL : MARCH_HEAL), 0);
  let healed = 0;
  for (const h of heroesAfter) {
    if (h.hp <= 0 || h.hp >= h.maxHp) continue;
    const amount = Math.min(h.maxHp - h.hp, Math.round(h.maxHp * share));
    h.hp += amount;
    healed += amount;
  }
  const log: RaidLogEntry[] = healed > 0
    ? [{ roomKey, kind: "heal", message: `${healers.map((h) => h.name).join(" et ")} soigne${healers.length > 1 ? "nt" : ""} l'équipe entre deux salles (+${healed} PV).` }]
    : [];
  return { heroesAfter, log };
}

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
    // Utility tags (disarm/scout) work outside combat: in a fight the hero attacks plainly.
    const tag = actor.raidEffectTag === "disarm" || actor.raidEffectTag === "scout" ? undefined : actor.raidEffectTag;
    const bonus = !!actor.raidEffectBonus;

    let rawDamage = damageOf(rng, value);
    if (tag === "execute" && target.hp / target.maxHp < 0.3) rawDamage = Math.round(rawDamage * magnitude(tag, bonus));
    if (tag === "poison") rawDamage = Math.round(rawDamage * magnitude(tag, bonus));

    const rawDef = type === "phys" ? target.defPhys : target.defMag;
    const effectiveDef = tag === "pierce" ? rawDef * (1 - magnitude(tag, bonus)) : rawDef;
    let mitigated = Math.max(1, rawDamage - Math.round(effectiveDef * 0.5));
    const crit = rng() < critChance(actor.crit);
    if (crit) mitigated = Math.round(mitigated * critMultiplier(actor.critDmg));
    const elemMul = elementalMultiplier(actor.element, actor.element ? target.res?.[actor.element] : 0);
    mitigated = Math.max(1, Math.round(mitigated * elemMul));
    // Weakened heroes hit softer and are hit harder (only heroes carry stacks).
    const actorWeak = (actor as { weakened?: number }).weakened ?? 0;
    const targetWeak = (target as { weakened?: number }).weakened ?? 0;
    if (actorWeak || targetWeak) {
      mitigated = Math.max(1, Math.round(mitigated * (1 - WEAKEN_PER_STACK * actorWeak) * (1 + WEAKEN_PER_STACK * targetWeak)));
    }

    const shieldReduction = effect.shielded.get(target.id);
    if (shieldReduction) {
      mitigated = Math.max(1, Math.round(mitigated * (1 - shieldReduction)));
      effect.shielded.delete(target.id);
    }

    target.hp = Math.max(0, target.hp - mitigated);
    log.push({
      roomKey,
      kind: "attack",
      message: `${actor.name} inflige ${mitigated} dégâts${crit ? " critiques" : ""} à ${target.name}${elemMul > 1 ? " (point faible !)" : elemMul < 1 ? " (résiste)" : ""} (${target.hp} PV restants).`,
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

  if (healer && healer.hp > 0 && effect.stunned.has(healer.id)) {
    effect.stunned.delete(healer.id);
    log.push({
      roomKey,
      kind: "info",
      message: `${healer.name} est étourdi et ne peut agir.`,
      actorId: healer.id,
    });
  } else if (healer && healer.hp > 0) {
    // Most wounded ally by HP ratio — the lowest absolute HP may well be a full-health squishy.
    const lowest = alive
      .filter((u) => u.hp > 0 && u.hp < u.maxHp)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (lowest) {
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
  const weak = attackers.filter((a) => a.hp > 0 && (a.weakened ?? 0) > 0);
  if (weak.length > 0) {
    log.push({
      roomKey,
      kind: "info",
      message: `Encore sonnés par les pièges, ${weak.map((a) => `${a.name} (×${a.weakened})`).join(", ")} combat${weak.length > 1 ? "tent" : ""} affaibli${weak.length > 1 ? "s" : ""}.`,
    });
  }

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
  if (!cleared && attackers.some((a) => a.hp > 0)) {
    log.push({
      roomKey,
      kind: "info",
      message: "Le combat s'éternise : épuisés, vos héros finissent submergés.",
    });
  }
  for (const a of attackers) a.weakened = 0;
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

/** Applies a trap's damage (a % of max HP) to the whole attacking team. `stackIndex` is the trap's
 *  position in its room (each extra stacked trap hits for TRAP_STACK_FALLOFF less); each hero's
 *  trapRes, its resistance to the trap's element and the party's disarm aura all reduce the hit. */
export function resolveTrapTrigger(
  roomKey: string,
  heroes: RaidHeroState[],
  trap: TrapDefinition,
  rng: () => number,
  stackIndex = 0,
  disarm = 0,
  /** The defender's Trapcraft bonus. */
  damageMultiplier = 1,
  /** Hero id -> share of max HP this room's traps may still deal (see TRAP_ROOM_DAMAGE_CAP). Mutated. */
  roomBudget?: Map<string, number>,
): TrapTriggerResult {
  const heroesAfter = heroes.map((h) => ({ ...h }));
  const log: RaidLogEntry[] = [];
  const stackMul = Math.pow(TRAP_STACK_FALLOFF, stackIndex);

  for (const hero of heroesAfter) {
    if (hero.hp <= 0) continue;
    const variance = 0.9 + rng() * 0.2;
    const trapRes = Math.min(MAX_TRAP_RESISTANCE, Math.max(0, hero.trapRes ?? 0)) / 100;
    const elemMul = elementalMultiplier(trap.element, trap.element ? hero.res?.[trap.element] : 0);
    let raw = trap.damagePercent * variance * stackMul * damageMultiplier;
    if (roomBudget) {
      const left = roomBudget.get(hero.id) ?? TRAP_ROOM_DAMAGE_CAP;
      raw = Math.min(raw, left);
      roomBudget.set(hero.id, left - raw);
    }
    // Non-lethal: a trap leaves at least 1 HP.
    const dmg = Math.min(hero.hp - 1, Math.max(raw > 0 ? 1 : 0, Math.round(hero.maxHp * raw * (1 - trapRes) * (1 - disarm) * elemMul)));
    if (dmg <= 0) continue;
    hero.hp -= dmg;
    if (hero.hp > 0 && dmg >= hero.maxHp * WEAKEN_THRESHOLD) hero.weakened = Math.min(MAX_WEAKENED, (hero.weakened ?? 0) + 1);
    log.push({
      roomKey,
      kind: "trap",
      message: `${trap.name} inflige ${dmg} dégâts à ${hero.name} (${hero.hp} PV restants${hero.hp === 1 ? ", de justesse" : ""}).`,
      targetId: hero.id,
      hpAfter: hero.hp,
    });
  }

  return { heroesAfter, log, wiped: heroesAfter.every((h) => h.hp <= 0) };
}
