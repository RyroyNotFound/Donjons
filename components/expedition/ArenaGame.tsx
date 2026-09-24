"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/Button";
import { HERO_SPRITE_BY_ROLE, CLASS_TINT } from "@/lib/ui/heroSprites";
import { MONSTER_SPRITE } from "@/lib/ui/monsterSprites";
import {
  ARENA_CONSTANTS,
  ARENA_HEIGHT,
  ARENA_SPELL_TAGS,
  ARENA_WIDTH,
  chooseUpgrade,
  createArenaRng,
  createInitialState,
  getCard,
  HAZARD_WARNING_SEC,
  runResult,
  stepArena,
  xpToNextLevel,
  type ArenaHeroInput,
  type ArenaState,
} from "@/lib/game/arena/engine";
import type { ArenaRunResult, Role, ZoneDefinition } from "@/types/game";

const KEY_MAP: Record<string, "up" | "down" | "left" | "right"> = {
  w: "up",
  z: "up",
  arrowup: "up",
  s: "down",
  arrowdown: "down",
  a: "left",
  q: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
};

const SPRITE_FRAMES = 4;
const SPRITE_FRAME_SIZE = 32;
const SPRITE_FRAME_DURATION = 0.15;
const ROLES: Role[] = ["DPS", "HEAL", "TANK"];

function loadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  elapsedSec: number,
  x: number,
  y: number,
  size: number,
) {
  if (!img || !img.complete || img.naturalWidth === 0) {
    ctx.beginPath();
    ctx.arc(x, y, size / 3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const frame = Math.floor(elapsedSec / SPRITE_FRAME_DURATION) % SPRITE_FRAMES;
  ctx.drawImage(img, frame * SPRITE_FRAME_SIZE, 0, SPRITE_FRAME_SIZE, SPRITE_FRAME_SIZE, x - size / 2, y - size / 2, size, size);
}

function createBackgroundCanvas(zone: ZoneDefinition): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = ARENA_WIDTH;
  canvas.height = ARENA_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const gradient = ctx.createRadialGradient(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 40, ARENA_WIDTH / 2, ARENA_HEIGHT / 2, ARENA_WIDTH * 0.75);
  gradient.addColorStop(0, zone.theme.inner);
  gradient.addColorStop(1, zone.theme.outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.05)";
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

function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, ratio: number, color: string) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - width / 2, y, width, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x - width / 2, y, width * Math.max(0, ratio), 4);
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: ArenaState,
  background: HTMLCanvasElement | null,
  monsterImages: Record<string, HTMLImageElement>,
  heroImages: Record<Role, HTMLImageElement>,
) {
  ctx.imageSmoothingEnabled = false;
  if (background) ctx.drawImage(background, 0, 0);
  else {
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  }

  // Hazard warnings: the inner disc fills up until impact.
  for (const hz of state.hazards) {
    const progress = 1 - Math.max(0, hz.timer) / HAZARD_WARNING_SEC;
    ctx.fillStyle = "rgba(239,68,68,0.12)";
    ctx.strokeStyle = "rgba(248,113,113,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(249,115,22,0.35)";
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, hz.radius * progress, 0, Math.PI * 2);
    ctx.fill();
  }

  // XP gems.
  for (const gem of state.gems) {
    ctx.fillStyle = gem.value > 1 ? "#f0abfc" : "#67e8f9";
    const r = gem.value > 1 ? 6 : 4;
    ctx.beginPath();
    ctx.moveTo(gem.x, gem.y - r);
    ctx.lineTo(gem.x + r, gem.y);
    ctx.lineTo(gem.x, gem.y + r);
    ctx.lineTo(gem.x - r, gem.y);
    ctx.fill();
  }

  // Enemies.
  for (const enemy of state.enemies) {
    ctx.fillStyle = "#f87171";
    if (enemy.kind === "elite") ctx.filter = "saturate(1.8) hue-rotate(-25deg) brightness(1.15)";
    if (enemy.kind === "boss") ctx.filter = "saturate(1.5) brightness(1.2) drop-shadow(0 0 6px #ef4444)";
    drawSprite(ctx, monsterImages[enemy.refId], state.elapsedSec, enemy.x, enemy.y, enemy.radius * 2.4);
    ctx.filter = "none";
    if (enemy.kind !== "normal" || enemy.hp < enemy.maxHp) {
      drawBar(ctx, enemy.x, enemy.y - enemy.radius - 10, enemy.radius * 2, enemy.hp / enemy.maxHp, enemy.kind === "normal" ? "#f87171" : "#fb923c");
    }
  }

  // Heroes.
  state.heroes.forEach((hero, index) => {
    if (!hero.alive) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#71717a";
      ctx.beginPath();
      ctx.arc(hero.x, hero.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    if (index === state.leaderIndex) {
      ctx.strokeStyle = "rgba(251,191,36,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(hero.x, hero.y + 14, 14, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#e5e7eb";
    ctx.filter = hero.classId ? CLASS_TINT[hero.classId] ?? "none" : "grayscale(1)";
    drawSprite(ctx, heroImages[hero.role ?? "TANK"], state.elapsedSec, hero.x, hero.y, ARENA_CONSTANTS.HERO_RADIUS * 2.6);
    ctx.filter = "none";
    drawBar(ctx, hero.x, hero.y - 24, 28, hero.hp / hero.maxHp, "#34d399");
  });

  // Projectiles.
  for (const p of state.projectiles) {
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Effects.
  for (const e of state.effects) {
    const alpha = Math.max(0, e.life / e.maxLife);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = e.color;
    ctx.fillStyle = e.color;
    if (e.kind === "ring") {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * (1.1 - alpha * 0.3), 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.kind === "beam" && e.x2 !== undefined && e.y2 !== undefined) {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x2, e.y2);
      ctx.stroke();
    } else if (e.kind === "text" && e.text) {
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(e.text, e.x, e.y - (1 - alpha) * 16);
    }
    ctx.globalAlpha = 1;
  }
}

interface HudHero {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  leader: boolean;
  spells: string[];
}

interface Hud {
  elapsedSec: number;
  killCount: number;
  level: number;
  xp: number;
  xpNext: number;
  heroes: HudHero[];
  boss?: { name: string; hp: number; maxHp: number };
  hasteActive: boolean;
  dmgActive: boolean;
  choices: string[] | null;
}

function toHud(state: ArenaState): Hud {
  const boss = state.enemies.find((e) => e.kind === "boss");
  return {
    elapsedSec: state.elapsedSec,
    killCount: state.killCount,
    level: state.level,
    xp: state.xp,
    xpNext: xpToNextLevel(state.level),
    heroes: state.heroes.map((h, i) => ({
      id: h.id,
      name: h.name,
      hp: Math.round(h.hp),
      maxHp: Math.round(h.maxHp),
      alive: h.alive,
      leader: i === state.leaderIndex,
      spells: h.spells.map((s) => ARENA_SPELL_TAGS[s.tag].icon),
    })),
    boss: boss ? { name: boss.name, hp: Math.max(0, Math.round(boss.hp)), maxHp: Math.round(boss.maxHp) } : undefined,
    hasteActive: state.buffs.hasteTimer > 0,
    dmgActive: state.buffs.dmgTimer > 0,
    choices: state.pendingChoices ? [...state.pendingChoices] : null,
  };
}

interface ArenaGameProps {
  zone: ZoneDefinition;
  party: ArenaHeroInput[];
  componentRanks?: Record<string, number>;
  seed: string;
  onFinish: (result: ArenaRunResult) => void;
}

export function ArenaGame({ zone, party, componentRanks, seed, onFinish }: ArenaGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundRef = useRef<HTMLCanvasElement | null>(null);
  const [initialState] = useState(() => createInitialState(party, componentRanks));
  const stateRef = useRef<ArenaState>(initialState);
  const rngRef = useRef(createArenaRng(seed));
  const pressedRef = useRef(new Set<"up" | "down" | "left" | "right">());
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const finishedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [hud, setHud] = useState<Hud>(() => toHud(initialState));
  const [heroImages] = useState(
    () => Object.fromEntries(ROLES.map((role) => [role, loadImage(HERO_SPRITE_BY_ROLE[role])])) as Record<Role, HTMLImageElement>,
  );
  const [monsterImages] = useState<Record<string, HTMLImageElement>>(() =>
    Object.fromEntries(Object.entries(MONSTER_SPRITE).map(([id, src]) => [id, loadImage(src)])),
  );

  const pick = useCallback((cardId: string) => {
    chooseUpgrade(stateRef.current, cardId, rngRef.current);
    setHud(toHud(stateRef.current));
  }, []);

  const flee = useCallback(() => {
    if (stateRef.current.outcome === "playing") stateRef.current.outcome = "defaite";
  }, []);

  useEffect(() => {
    backgroundRef.current = createBackgroundCanvas(zone);
  }, [zone]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (!started) {
        setStarted(true);
        return;
      }
      const choices = stateRef.current.pendingChoices;
      if (choices && ["1", "2", "3"].includes(key)) {
        const cardId = choices[Number(key) - 1];
        if (cardId) pick(cardId);
        return;
      }
      const dir = KEY_MAP[key];
      if (dir) {
        e.preventDefault();
        pressedRef.current.add(dir);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      const dir = KEY_MAP[e.key.toLowerCase()];
      if (dir) pressedRef.current.delete(dir);
    }
    // Alt-Tab or a tab switch swallows the keyup: drop every held direction.
    function releaseAll() {
      pressedRef.current.clear();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", releaseAll);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", releaseAll);
    };
  }, [started, pick]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let raf: number;
    let last = performance.now();
    let hudThrottle = 0;

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const state = stateRef.current;

      if (started) {
        const pressed = pressedRef.current;
        let dx = (pressed.has("right") ? 1 : 0) - (pressed.has("left") ? 1 : 0);
        let dy = (pressed.has("down") ? 1 : 0) - (pressed.has("up") ? 1 : 0);
        const pointer = pointerRef.current;
        if (pointer) {
          const leader = state.heroes[state.leaderIndex];
          const px = pointer.x - leader.x;
          const py = pointer.y - leader.y;
          if (Math.hypot(px, py) > 8) {
            dx = px;
            dy = py;
          }
        }
        stepArena(state, dt, { dx, dy }, zone, rngRef.current);
      }
      draw(ctx!, state, backgroundRef.current, monsterImages, heroImages);

      hudThrottle += dt;
      if (hudThrottle > 0.1) {
        hudThrottle = 0;
        setHud(toHud(state));
      }

      if (state.outcome !== "playing") {
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinish(runResult(state));
        }
        return;
      }
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  function toArenaCoords(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * ARENA_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * ARENA_HEIGHT,
    };
  }

  const remaining = Math.max(0, zone.durationSec - hud.elapsedSec);
  const bossIn = Math.max(0, zone.boss.spawnAtSec - hud.elapsedSec);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-300">
        <span className="font-semibold text-slate-100">⏳ {Math.ceil(remaining)}s</span>
        <span className="text-amber-300">☠️ {hud.killCount}</span>
        <div className="flex min-w-40 flex-1 items-center gap-2">
          <span className="text-cyan-300">Nv. {hud.level}</span>
          <div className="flex-1">
            <ProgressBar value={hud.xp} max={hud.xpNext} colorClassName="from-cyan-400 to-cyan-600" label="Expérience" />
          </div>
        </div>
        {hud.hasteActive && <span className="text-cyan-300">🍃 Frénésie</span>}
        {hud.dmgActive && <span className="text-amber-300">🛡️ Bénédiction</span>}
        {!hud.boss && bossIn > 0 && <span className="text-xs text-slate-500">Boss dans {Math.ceil(bossIn)}s</span>}
        <Button size="sm" variant="ghost" onClick={flee} disabled={!started}>
          Fuir
        </Button>
      </div>

      {hud.boss && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2">
          <div className="mb-1 flex justify-between text-xs text-red-300">
            <span className="font-semibold">{hud.boss.name}</span>
            <span>
              {hud.boss.hp}/{hud.boss.maxHp}
            </span>
          </div>
          <ProgressBar value={hud.boss.hp} max={hud.boss.maxHp} colorClassName="from-red-500 to-red-700" label="PV du boss" />
        </div>
      )}

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={ARENA_WIDTH}
          height={ARENA_HEIGHT}
          className="w-full max-w-full touch-none rounded-xl border border-amber-500/20 shadow-lg shadow-black/50"
          onPointerDown={(e) => {
            if (!started) {
              setStarted(true);
              return;
            }
            e.currentTarget.setPointerCapture(e.pointerId);
            pointerRef.current = toArenaCoords(e);
          }}
          onPointerMove={(e) => {
            if (pointerRef.current) pointerRef.current = toArenaCoords(e);
          }}
          onPointerUp={() => (pointerRef.current = null)}
          onPointerCancel={() => (pointerRef.current = null)}
        />

        {!started && (
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/60 text-center"
          >
            <span className="font-display text-2xl font-bold text-amber-300">Prêt ?</span>
            <span className="text-sm text-slate-300">Clique ou appuie sur une touche pour lancer l&apos;expédition</span>
            <span className="text-xs text-slate-500">
              ZQSD / WASD / flèches, ou maintiens le clic (ou le doigt) pour guider ton chef d&apos;équipe.
            </span>
            {zone.hazard && (
              <span className="text-xs text-orange-300">
                {zone.hazard.name} : sors des cercles rouges avant l&apos;impact ({Math.round(zone.hazard.damagePct * 100)}% des PV max).
              </span>
            )}
          </button>
        )}

        {hud.choices && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/70 p-4">
            <p className="font-display text-xl font-bold text-cyan-300">Niveau {hud.level} ! Choisis une amélioration</p>
            <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
              {hud.choices.map((cardId, i) => {
                const card = getCard(cardId);
                if (!card) return null;
                return (
                  <button
                    key={cardId}
                    type="button"
                    onClick={() => pick(cardId)}
                    className="rounded-lg border border-cyan-500/40 bg-slate-900/90 p-3 text-left transition hover:border-cyan-300 hover:bg-slate-800"
                  >
                    <p className="text-2xl">{card.icon}</p>
                    <p className="mt-1 font-semibold text-slate-100">{card.name}</p>
                    <p className="text-xs text-slate-400">{card.description}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-500">Touche {i + 1}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {hud.heroes.map((hero) => (
          <div
            key={hero.id}
            className={`rounded-lg border px-3 py-2 text-xs ${
              hero.alive ? (hero.leader ? "border-amber-500/50 bg-amber-500/5" : "border-white/10 bg-black/20") : "border-red-900/50 bg-red-950/20 opacity-60"
            }`}
          >
            <div className="mb-1 flex justify-between text-slate-300">
              <span className="font-semibold">
                {hero.leader && "👑 "}
                {hero.name}
              </span>
              <span>{hero.alive ? `${hero.hp}/${hero.maxHp}` : "KO"}</span>
            </div>
            <ProgressBar value={hero.hp} max={hero.maxHp} colorClassName="from-emerald-400 to-emerald-600" label={`PV de ${hero.name}`} />
            {hero.spells.length > 0 && <p className="mt-1 tracking-widest">{hero.spells.join(" ")}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
