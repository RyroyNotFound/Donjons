"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { focusRing } from "@/lib/ui/a11y";
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
    if (enemy.slowTimer > 0) ctx.filter = `${ctx.filter === "none" ? "" : ctx.filter + " "}drop-shadow(0 0 4px #7dd3fc)`;
    if (enemy.poisonTimer > 0) ctx.filter = `${ctx.filter === "none" ? "" : ctx.filter + " "}drop-shadow(0 0 4px #a3e635)`;
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
    if (hero.shield > 0) {
      ctx.strokeStyle = "rgba(147,197,253,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hero.x, hero.y, ARENA_CONSTANTS.HERO_RADIUS + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
        <span
          className={`flex items-center gap-1.5 font-semibold tabular-nums transition-colors duration-200 ${
            started && remaining <= 10 ? "text-red-300" : "text-fg"
          }`}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-fg-subtle" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
            <circle cx="8" cy="8.5" r="5.5" />
            <path d="M8 5.5v3l2 1.5M6.5 1.5h3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {Math.ceil(remaining)}s
        </span>
        <span className="tabular-nums text-fg-muted">
          ☠️ <span className="font-semibold text-fg">{hud.killCount}</span>
        </span>
        <div className="flex min-w-40 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs font-semibold tabular-nums text-sky-300">Nv. {hud.level}</span>
          <div className="flex-1">
            <ProgressBar value={hud.xp} max={hud.xpNext} size="sm" colorClassName="from-sky-500 to-sky-300" label="Expérience" />
          </div>
        </div>
        {hud.hasteActive && <Badge tone="info">Frénésie</Badge>}
        {hud.dmgActive && <Badge tone="gold">Bénédiction</Badge>}
        {!hud.boss && bossIn > 0 && <span className="text-xs tabular-nums text-fg-subtle">Boss dans {Math.ceil(bossIn)}s</span>}
        <Button size="sm" variant="ghost" onClick={flee} disabled={!started} className="ml-auto">
          Fuir
        </Button>
      </div>

      {hud.boss && (
        <div className="animate-fade rounded-xl border border-red-400/25 bg-red-400/[0.06] px-3 py-2">
          <div className="mb-1.5 flex justify-between gap-3 text-xs">
            <span className="font-semibold text-red-300">{hud.boss.name}</span>
            <span className="tabular-nums text-red-300/80">
              {hud.boss.hp}/{hud.boss.maxHp}
            </span>
          </div>
          <ProgressBar value={hud.boss.hp} max={hud.boss.maxHp} colorClassName="from-red-600 to-red-400" label="PV du boss" />
        </div>
      )}

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={ARENA_WIDTH}
          height={ARENA_HEIGHT}
          className="w-full max-w-full touch-none rounded-xl border border-line-strong shadow-[0_12px_32px_-12px_rgb(0_0_0/0.6)]"
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
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/70 px-4 text-center backdrop-blur-sm ${focusRing}`}
          >
            <span className="font-display text-2xl font-semibold text-gold sm:text-3xl">Prêt ?</span>
            <span className="text-sm text-fg">Clique ou appuie sur une touche pour lancer l&apos;expédition</span>
            <span className="max-w-md text-xs leading-relaxed text-fg-subtle">
              ZQSD / WASD / flèches, ou maintiens le clic (ou le doigt) pour guider ton chef d&apos;équipe.
            </span>
            {zone.hazard && (
              <span className="mt-1 max-w-md rounded-md border border-orange-400/25 bg-orange-400/10 px-2 py-1 text-xs text-orange-300">
                {zone.hazard.name} : sors des cercles rouges avant l&apos;impact ({Math.round(zone.hazard.damagePct * 100)}% des PV max).
              </span>
            )}
          </button>
        )}

        {hud.choices && (
          <div className="animate-fade absolute inset-0 flex flex-col items-center justify-center-safe gap-3 overflow-y-auto rounded-xl bg-black/70 p-3 backdrop-blur-sm sm:p-4">
            <p className="text-center text-base font-semibold text-fg sm:text-lg">
              <span className="tabular-nums text-sky-300">Niveau {hud.level} !</span> Choisis une amélioration
            </p>
            <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-3 sm:gap-3">
              {hud.choices.map((cardId, i) => {
                const card = getCard(cardId);
                if (!card) return null;
                return (
                  <button
                    key={cardId}
                    type="button"
                    onClick={() => pick(cardId)}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className={`animate-pop group flex items-start gap-3 rounded-xl border border-line-strong bg-surface p-3 text-left shadow-[inset_0_1px_0_rgb(255_255_255/0.04),0_12px_24px_-12px_rgb(0_0_0/0.6)] transition-[transform,border-color,background-color] duration-150 ease-out hover:border-gold/50 hover:bg-surface-2 active:scale-[0.97] sm:flex-col sm:gap-0 ${focusRing}`}
                  >
                    <p className="text-2xl leading-none">{card.icon}</p>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-fg sm:mt-2">{card.name}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{card.description}</p>
                      <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-fg-faint transition-colors duration-150 group-hover:text-gold">
                        Touche {i + 1}
                      </p>
                    </div>
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
            className={`rounded-lg border px-3 py-2 text-xs transition-[opacity,border-color,background-color] duration-200 ease-out ${
              hero.alive
                ? hero.leader
                  ? "border-gold/30 bg-gold/[0.05]"
                  : "border-line bg-surface"
                : "border-red-400/20 bg-red-400/[0.04] opacity-60"
            }`}
          >
            <div className="mb-1.5 flex justify-between gap-2">
              <span className="min-w-0 truncate font-semibold text-fg">
                {hero.leader && "👑 "}
                {hero.name}
              </span>
              <span className={`shrink-0 tabular-nums ${hero.alive ? "text-fg-muted" : "font-semibold text-red-300"}`}>
                {hero.alive ? `${hero.hp}/${hero.maxHp}` : "KO"}
              </span>
            </div>
            <ProgressBar
              value={hero.hp}
              max={hero.maxHp}
              size="sm"
              colorClassName="from-emerald-500 to-emerald-300"
              label={`PV de ${hero.name}`}
            />
            {hero.spells.length > 0 && <p className="mt-1.5 tracking-widest">{hero.spells.join(" ")}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
