import { createRng, randomInt } from "@/lib/game/engine/rng";
import { getMonster } from "@/lib/game/content/dungeon";
import type { HeroStats, ZoneDefinition } from "@/types/game";

export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 500;
const PLAYER_RADIUS = 16;
const ENEMY_RADIUS = 14;
const ATTACK_RANGE_PX = 110;
const MELEE_CLEAVE_RADIUS_PX = 60;
const PROJECTILE_SPEED = 480;
const PROJECTILE_RADIUS = 5;
const PROJECTILE_MAX_LIFE_SEC = 1;

/**
 * Per-subclass party bonuses, applied in the arena based on how many heroes
 * of that subclass are in the selected team. Each subclass grants a
 * distinct effect so team composition matters beyond raw stats:
 * - Guerrier: melee cleave near the player on every attack
 * - Archer: one extra projectile per archer
 * - Prêtre: passive HP regen over time
 * - Druide: faster attack pace (shorter cooldown)
 * - Paladin: flat damage buff to the whole party's attacks
 * - Colosse: lifesteal on damage dealt
 */
export interface PartyAbilities {
  guerrier: number;
  archer: number;
  pretre: number;
  druide: number;
  paladin: number;
  colosse: number;
}

export const EMPTY_ABILITIES: PartyAbilities = {
  guerrier: 0,
  archer: 0,
  pretre: 0,
  druide: 0,
  paladin: 0,
  colosse: 0,
};

/** Counts how many heroes of each ability-granting subclass are in the party. */
export function computePartyAbilities(subclassIds: string[]): PartyAbilities {
  const abilities = { ...EMPTY_ABILITIES };
  for (const id of subclassIds) {
    if (id in abilities) abilities[id as keyof PartyAbilities] += 1;
  }
  return abilities;
}

export interface ArenaPlayer {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  attackDamage: number;
  attackCooldownSec: number;
  attackTimer: number;
}

export interface ArenaEnemy {
  id: number;
  refId: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  contactDamage: number;
  contactCooldown: number;
  contactTimer: number;
}

export interface ArenaProjectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
}

export interface ArenaState {
  player: ArenaPlayer;
  enemies: ArenaEnemy[];
  projectiles: ArenaProjectile[];
  abilities: PartyAbilities;
  healTickTimer: number;
  elapsedSec: number;
  killCount: number;
  spawnedCount: number;
  nextSpawnAt: number;
  nextEnemyId: number;
  nextProjectileId: number;
  outcome: "playing" | "victoire" | "defaite";
}

/** Converts aggregated party stats + subclass bonuses into arena-scale movement/combat numbers. */
export function createInitialState(
  partyStats: HeroStats,
  abilities: PartyAbilities = EMPTY_ABILITIES,
): ArenaState {
  const baseCooldown = Math.max(0.25, 1.1 - partyStats.spd * 0.01);
  const attackCooldownSec = Math.max(0.15, baseCooldown * (1 - 0.12 * abilities.druide));
  const attackDamage = Math.max(4, partyStats.atk) * (1 + 0.1 * abilities.paladin);

  return {
    player: {
      x: ARENA_WIDTH / 2,
      y: ARENA_HEIGHT / 2,
      hp: partyStats.hp,
      maxHp: partyStats.hp,
      speed: 90 + partyStats.spd * 3,
      attackDamage,
      attackCooldownSec,
      attackTimer: 0,
    },
    enemies: [],
    projectiles: [],
    abilities,
    healTickTimer: 1,
    elapsedSec: 0,
    killCount: 0,
    spawnedCount: 0,
    nextSpawnAt: 0,
    nextEnemyId: 1,
    nextProjectileId: 1,
    outcome: "playing",
  };
}

/** Applies damage to an enemy, triggering Colosse lifesteal if the party has any. */
function dealDamage(state: ArenaState, enemy: ArenaEnemy, amount: number) {
  enemy.hp -= amount;
  if (state.abilities.colosse > 0) {
    const drainRatio = Math.min(0.6, 0.12 * state.abilities.colosse);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + amount * drainRatio);
  }
}

function spawnWave(state: ArenaState, zone: ZoneDefinition, rng: () => number) {
  const waveSize = zone.baseWaveSize + Math.floor(state.elapsedSec / (zone.durationSec / 3));
  for (let i = 0; i < waveSize; i++) {
    const refId = zone.monsterPool[randomInt(rng, 0, zone.monsterPool.length - 1)];
    const def = getMonster(refId);
    const side = randomInt(rng, 0, 3);
    const x = side === 0 ? 0 : side === 1 ? ARENA_WIDTH : randomInt(rng, 0, ARENA_WIDTH);
    const y = side === 2 ? 0 : side === 3 ? ARENA_HEIGHT : randomInt(rng, 0, ARENA_HEIGHT);
    state.enemies.push({
      id: state.nextEnemyId++,
      refId,
      name: def.name,
      x,
      y,
      hp: def.stats.hp * 0.4,
      maxHp: def.stats.hp * 0.4,
      speed: 35 + def.stats.spd * 1.5,
      contactDamage: Math.max(2, def.stats.atk * 0.35),
      contactCooldown: 0.6,
      contactTimer: 0,
    });
    state.spawnedCount++;
  }
}

export interface ArenaInput {
  dx: number;
  dy: number;
}

/** Advances the simulation by `dt` seconds. Mutates and returns `state`. Deterministic given `seed`. */
export function stepArena(
  state: ArenaState,
  dt: number,
  input: ArenaInput,
  zone: ZoneDefinition,
  rng: () => number,
): ArenaState {
  if (state.outcome !== "playing") return state;

  state.elapsedSec += dt;

  state.healTickTimer -= dt;
  if (state.healTickTimer <= 0) {
    state.healTickTimer += 1;
    if (state.abilities.pretre > 0) {
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.abilities.pretre * 4);
    }
  }

  if (state.elapsedSec >= state.nextSpawnAt) {
    spawnWave(state, zone, rng);
    state.nextSpawnAt = state.elapsedSec + zone.spawnIntervalSec;
  }

  const len = Math.hypot(input.dx, input.dy) || 1;
  const moveX = (input.dx / len) * state.player.speed * dt;
  const moveY = (input.dy / len) * state.player.speed * dt;
  state.player.x = Math.min(ARENA_WIDTH - PLAYER_RADIUS, Math.max(PLAYER_RADIUS, state.player.x + moveX));
  state.player.y = Math.min(ARENA_HEIGHT - PLAYER_RADIUS, Math.max(PLAYER_RADIUS, state.player.y + moveY));

  for (const enemy of state.enemies) {
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / dist) * enemy.speed * dt;
    enemy.y += (dy / dist) * enemy.speed * dt;

    enemy.contactTimer -= dt;
    if (dist < PLAYER_RADIUS + ENEMY_RADIUS && enemy.contactTimer <= 0) {
      state.player.hp = Math.max(0, state.player.hp - enemy.contactDamage);
      enemy.contactTimer = enemy.contactCooldown;
    }
  }

  state.player.attackTimer -= dt;
  if (state.player.attackTimer <= 0 && state.enemies.length > 0) {
    const inRange = state.enemies
      .map((enemy) => ({ enemy, dist: Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) }))
      .filter((o) => o.dist <= ATTACK_RANGE_PX)
      .sort((a, b) => a.dist - b.dist);

    if (inRange.length > 0) {
      const shotCount = 1 + state.abilities.archer;
      for (let i = 0; i < shotCount; i++) {
        const target = inRange[Math.min(i, inRange.length - 1)].enemy;
        const dx = target.x - state.player.x;
        const dy = target.y - state.player.y;
        const dist = Math.hypot(dx, dy) || 1;
        state.projectiles.push({
          id: state.nextProjectileId++,
          x: state.player.x,
          y: state.player.y,
          vx: (dx / dist) * PROJECTILE_SPEED,
          vy: (dy / dist) * PROJECTILE_SPEED,
          damage: state.player.attackDamage,
          life: PROJECTILE_MAX_LIFE_SEC,
        });
      }

      if (state.abilities.guerrier > 0) {
        const cleaveDamage = state.player.attackDamage * 0.5 * state.abilities.guerrier;
        for (const enemy of state.enemies) {
          const dist = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
          if (dist <= MELEE_CLEAVE_RADIUS_PX) dealDamage(state, enemy, cleaveDamage);
        }
      }

      state.player.attackTimer = state.player.attackCooldownSec;
    }
  }

  for (const projectile of state.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      const dist = Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y);
      if (dist < ENEMY_RADIUS + PROJECTILE_RADIUS) {
        dealDamage(state, enemy, projectile.damage);
        projectile.life = 0;
        break;
      }
    }
  }
  state.projectiles = state.projectiles.filter(
    (p) => p.life > 0 && p.x >= 0 && p.x <= ARENA_WIDTH && p.y >= 0 && p.y <= ARENA_HEIGHT,
  );

  const dead = state.enemies.filter((e) => e.hp <= 0);
  if (dead.length > 0) {
    state.killCount += dead.length;
    state.enemies = state.enemies.filter((e) => e.hp > 0);
  }

  if (state.player.hp <= 0) {
    state.outcome = "defaite";
  } else if (state.elapsedSec >= zone.durationSec) {
    state.outcome = "victoire";
  }

  return state;
}

export function createArenaRng(seed: string): () => number {
  return createRng(seed);
}

export const ARENA_CONSTANTS = {
  PLAYER_RADIUS,
  ENEMY_RADIUS,
  ATTACK_RANGE_PX,
  PROJECTILE_RADIUS,
};
