"use client";

import { useEffect, useRef, useState } from "react";
import {
  ARENA_CONSTANTS,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  createArenaRng,
  createInitialState,
  stepArena,
  type ArenaState,
  type PartyAbilities,
} from "@/lib/game/arena/engine";
import type { ArenaRunResult, HeroStats, ZoneDefinition } from "@/types/game";

const KEY_MAP: Record<string, "up" | "down" | "left" | "right"> = {
  w: "up",
  arrowup: "up",
  s: "down",
  arrowdown: "down",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
};

// No art pipeline yet, so emoji glyphs stand in for sprites — swap these for
// real images later without touching the simulation in lib/game/arena/engine.ts.
const PLAYER_SPRITE = "🧙";
const MONSTER_SPRITES: Record<string, string> = {
  "gobelin-eclaireur": "👺",
  "golem-de-pierre": "🗿",
  "araignee-venimeuse": "🕷️",
  "seigneur-des-ombres": "👹",
};

function createBackgroundCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = ARENA_WIDTH;
  canvas.height = ARENA_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const gradient = ctx.createRadialGradient(
    ARENA_WIDTH / 2,
    ARENA_HEIGHT / 2,
    40,
    ARENA_WIDTH / 2,
    ARENA_HEIGHT / 2,
    ARENA_WIDTH * 0.75,
  );
  gradient.addColorStop(0, "#20301f");
  gradient.addColorStop(1, "#0b100c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  const spacing = 42;
  for (let x = spacing / 2; x < ARENA_WIDTH; x += spacing) {
    for (let y = spacing / 2; y < ARENA_HEIGHT; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = "#3f3f46";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, ARENA_WIDTH - 3, ARENA_HEIGHT - 3);

  return canvas;
}

function describeAbilities(abilities: PartyAbilities): string[] {
  const labels: string[] = [];
  if (abilities.guerrier > 0) labels.push(`⚔️ Frappe proche x${abilities.guerrier}`);
  if (abilities.archer > 0) labels.push(`🏹 +${abilities.archer} projectile${abilities.archer > 1 ? "s" : ""}`);
  if (abilities.pretre > 0) labels.push(`✨ Soin passif x${abilities.pretre}`);
  if (abilities.druide > 0) labels.push(`🍃 Cadence +${Math.min(60, abilities.druide * 12)}%`);
  if (abilities.paladin > 0) labels.push(`🛡️ Dégâts +${Math.round(abilities.paladin * 10)}%`);
  if (abilities.colosse > 0) labels.push(`🩸 Vol de vie ${Math.min(60, abilities.colosse * 12)}%`);
  return labels;
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: ArenaState,
  background: HTMLCanvasElement | null,
) {
  if (background) {
    ctx.drawImage(background, 0, 0);
  } else {
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  }

  ctx.fillStyle = "#fde047";
  ctx.shadowColor = "#fde047";
  ctx.shadowBlur = 6;
  for (const projectile of state.projectiles) {
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, ARENA_CONSTANTS.PROJECTILE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const enemy of state.enemies) {
    const barWidth = ARENA_CONSTANTS.ENEMY_RADIUS * 2;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = "#3f3f46";
    ctx.fillRect(enemy.x - barWidth / 2, enemy.y - ARENA_CONSTANTS.ENEMY_RADIUS - 14, barWidth, 3);
    ctx.fillStyle = "#f87171";
    ctx.fillRect(
      enemy.x - barWidth / 2,
      enemy.y - ARENA_CONSTANTS.ENEMY_RADIUS - 14,
      barWidth * ratio,
      3,
    );

    ctx.font = "26px sans-serif";
    ctx.fillText(MONSTER_SPRITES[enemy.refId] ?? "👾", enemy.x, enemy.y);
  }

  ctx.font = "32px sans-serif";
  ctx.fillText(PLAYER_SPRITE, state.player.x, state.player.y);
}

interface ArenaGameProps {
  zone: ZoneDefinition;
  partyStats: HeroStats;
  abilities: PartyAbilities;
  seed: string;
  onFinish: (result: ArenaRunResult) => void;
}

export function ArenaGame({ zone, partyStats, abilities, seed, onFinish }: ArenaGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<ArenaState>(createInitialState(partyStats, abilities));
  const rngRef = useRef(createArenaRng(seed));
  const pressedRef = useRef(new Set<"up" | "down" | "left" | "right">());
  const finishedRef = useRef(false);
  const [hud, setHud] = useState({ hp: partyStats.hp, maxHp: partyStats.hp, elapsedSec: 0, killCount: 0 });

  useEffect(() => {
    backgroundRef.current = createBackgroundCanvas();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const dir = KEY_MAP[e.key.toLowerCase()];
      if (dir) pressedRef.current.add(dir);
    }
    function onKeyUp(e: KeyboardEvent) {
      const dir = KEY_MAP[e.key.toLowerCase()];
      if (dir) pressedRef.current.delete(dir);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let last = performance.now();
    let hudThrottle = 0;

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const pressed = pressedRef.current;
      const input = {
        dx: (pressed.has("right") ? 1 : 0) - (pressed.has("left") ? 1 : 0),
        dy: (pressed.has("down") ? 1 : 0) - (pressed.has("up") ? 1 : 0),
      };

      const state = stepArena(stateRef.current, dt, input, zone, rngRef.current);
      draw(ctx!, state, backgroundRef.current);

      hudThrottle += dt;
      if (hudThrottle > 0.1) {
        hudThrottle = 0;
        setHud({
          hp: Math.round(state.player.hp),
          maxHp: state.player.maxHp,
          elapsedSec: state.elapsedSec,
          killCount: state.killCount,
        });
      }

      if (state.outcome !== "playing") {
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinish({
            survived: state.outcome === "victoire",
            timeSurvivedMs: Math.round(state.elapsedSec * 1000),
            killCount: state.killCount,
            spawnedCount: state.spawnedCount,
          });
        }
        return;
      }

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = Math.max(0, zone.durationSec - hud.elapsedSec);
  const activeBonuses = describeAbilities(abilities);

  return (
    <div className="space-y-3">
      {activeBonuses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeBonuses.map((label) => (
            <span
              key={label}
              className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300"
            >
              {label}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-300">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">PV</span>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.max(0, (hud.hp / hud.maxHp) * 100)}%` }}
            />
          </div>
          <span>
            {hud.hp}/{hud.maxHp}
          </span>
        </div>
        <span>Temps restant : {Math.ceil(remaining)}s</span>
        <span>Kills : {hud.killCount}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={ARENA_WIDTH}
        height={ARENA_HEIGHT}
        className="w-full max-w-full rounded-xl border border-zinc-800"
      />
      <p className="text-xs text-zinc-500">Déplacement : WASD ou flèches. L&apos;attaque est automatique.</p>
    </div>
  );
}
