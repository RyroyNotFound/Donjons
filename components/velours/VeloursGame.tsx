"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { buttonClasses } from "@/components/Button";
import {
  CONQUEST_THRESHOLD,
  DRINKS,
  GIFTS,
  HOSTESSES,
  HOSTESS_BY_ID,
  MILESTONES,
  MOVES,
  STYLE_META,
  affectionLabel,
  affectionTier,
  type Hostess,
  type Topic,
} from "@/lib/velours/content";
import {
  GOAL,
  NIGHTLY_PAY,
  TURNS_PER_NIGHT,
  answer,
  buyDrink,
  giveGift,
  loadGame,
  moveChance,
  newGame,
  nextNight,
  pickTopic,
  proposeAfter,
  saveGame,
  tryMove,
  type Outcome,
  type VeloursState,
} from "@/lib/velours/engine";

const MOOD_ICON = { [-1]: "😒", 0: "😐", 1: "😊" } as const;
const MOOD_LABEL = { [-1]: "de mauvaise humeur", 0: "d'humeur neutre", 1: "de bonne humeur" } as const;

interface LogEntry {
  who: "her" | "you" | "sys";
  text: string;
  delta?: number;
}

/** Sprite variants generated from the Sutemo PSD into public/velours/<id>/. */
type Expression = "neutre" | "contente" | "rougit" | "fachee" | "scene";

const HOT_SPRITE: Record<Expression, string> = {
  neutre: "scene-neutre",
  contente: "scene-contente",
  rougit: "scene",
  fachee: "scene-fachee",
  scene: "scene",
};

/** `hot`: she stays in her unlocked outfit once the 70 scene was seen (or she's conquered). */
function spriteSrc(h: Hostess, e: Expression, hot = false) {
  return `/velours/${h.id}/${hot ? HOT_SPRITE[e] : e}.png`;
}

function isHot(state: VeloursState, id: string) {
  return state.conquered.includes(id) || (state.scenesSeen[id] ?? []).includes(MILESTONES[1]);
}

function expressionFor(delta: number): Expression {
  if (delta >= 10) return "rougit";
  if (delta > 0) return "contente";
  if (delta < 0) return "fachee";
  return "neutre";
}

/** Round face crop of the sprite, on the hostess' signature gradient. */
function Portrait({ h, expression = "neutre", hot = false }: { h: Hostess; expression?: Expression; hot?: boolean }) {
  return (
    <div
      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-to-br ${h.gradient} shadow-lg shadow-fuchsia-950/50 ring-2 ring-white/10`}
    >
      <Image
        src={spriteSrc(h, expression, hot)}
        alt={h.name}
        width={490}
        height={580}
        className="absolute left-1/2 top-0 w-[180%] max-w-none -translate-x-1/2 -translate-y-[4%]"
      />
    </div>
  );
}

/** Full bust sprite, crossfading between expressions. */
function Sprite({
  h,
  expression,
  hot = false,
  className = "",
}: {
  h: Hostess;
  expression: Expression;
  hot?: boolean;
  className?: string;
}) {
  const src = spriteSrc(h, expression, hot);
  return (
    <Image
      key={src}
      src={src}
      alt={h.name}
      width={490}
      height={580}
      priority
      className={`animate-[velours-fade_250ms_ease-out] select-none drop-shadow-[0_10px_30px_rgba(217,70,239,0.35)] ${className}`}
    />
  );
}

function AffectionBar({ value, conquered }: { value: number; conquered: boolean }) {
  return (
    <div className="w-full">
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            conquered ? "bg-gradient-to-r from-fuchsia-400 to-rose-400" : "bg-gradient-to-r from-rose-600 to-fuchsia-500"
          }`}
          style={{ width: `${conquered ? 100 : (value / CONQUEST_THRESHOLD) * 100}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{affectionLabel(value, conquered)}</span>
        {!conquered && <span>{value}/{CONQUEST_THRESHOLD}</span>}
      </div>
    </div>
  );
}

export function VeloursGame() {
  // The save lives in localStorage: render nothing until hydrated on the client.
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [state, setState] = useState<VeloursState | null>(() => (typeof window === "undefined" ? null : loadGame()));
  const [tableId, setTableId] = useState<string | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [scene, setScene] = useState<{
    h: Hostess;
    text: string;
    conquest: boolean;
    expression: Expression;
    /** Replayed from the souvenirs: closing just returns to the table. */
    replay?: boolean;
  } | null>(
    null,
  );
  const [expression, setExpression] = useState<Expression>("neutre");
  const [showGifts, setShowGifts] = useState(false);
  const [victorySeen, setVictorySeen] = useState(false);

  useEffect(() => {
    saveGame(state);
  }, [state]);

  if (!isClient) return null;

  if (!state) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-10 text-center">
        <div className="text-6xl">🍸</div>
        <h1 className="font-display bg-gradient-to-r from-fuchsia-400 via-rose-400 to-amber-300 bg-clip-text text-4xl font-bold text-transparent">
          Le Velours Noir
        </h1>
        <p className="text-slate-300">
          Un bar à hôtesses feutré, des néons rouges, dix femmes qui ont vu défiler tous les dragueurs de la ville.
          Ton objectif : <span className="font-semibold text-rose-300">les conquérir toutes les dix</span>. La dernière
          est la patronne. Personne ne l&apos;a jamais eue.
        </p>
        <ul className="mx-auto max-w-sm space-y-1 text-left text-sm text-slate-400">
          <li>🗣️ Chaque hôtesse a ses goûts : charme, humour, audace, sincérité ou flambe.</li>
          <li>🥂 Verres et cadeaux coûtent de l&apos;argent (+{NIGHTLY_PAY} € par nuit).</li>
          <li>🔥 Les gestes osés rapportent gros… ou te valent une gifle.</li>
          <li>🌙 {TURNS_PER_NIGHT} actions par nuit. Six filles en service chaque soir.</li>
        </ul>
        <p className="text-xs text-slate-500">Contenu suggestif, humour pour adultes. Tous les personnages sont majeurs.</p>
        <p className="text-[11px] text-slate-600">Sprites : « Anime Mature Woman » par Sutemo (itch.io).</p>
        <button onClick={() => setState(newGame())} className={buttonClasses("primary", "md", "px-6")}>
          Pousser la porte
        </button>
      </div>
    );
  }

  const s = state;
  const victory = s.conquered.length >= GOAL;
  const table = tableId ? HOSTESS_BY_ID[tableId] : null;

  function sit(id: string) {
    const h = HOSTESS_BY_ID[id];
    const conquered = s.conquered.includes(id);
    const aff = s.affection[id] ?? 0;
    setTableId(id);
    setShowGifts(false);
    setExpression(conquered ? "rougit" : aff >= 40 ? "contente" : "neutre");
    setLog([
      {
        who: "her",
        text: conquered
          ? "*Elle te fait un clin d'œil complice.* Toi… Tu reviens me voir ? Ce que tu m'as fait l'autre nuit, je m'en souviens encore."
          : aff === 0
            ? h.intro
            : "*Elle sourit en te voyant revenir.* Tiens, tiens. Tu ne pouvais pas rester loin de moi, hein ?",
      },
    ]);
    setTopic(conquered ? null : pickTopic(s, id));
  }

  function apply(result: readonly [VeloursState, Outcome] | null, yourLine: string) {
    if (!result || !table) return;
    const [next, outcome] = result;
    setState(next);
    const entries: LogEntry[] = [
      { who: "you", text: yourLine },
      { who: "her", text: outcome.line, delta: outcome.delta },
    ];
    setLog((l) => [...l, ...entries].slice(-8));
    setExpression(outcome.conquest ? "rougit" : expressionFor(outcome.delta));
    if (outcome.scene) {
      // First milestone keeps her outfit (blushing); the hotter ones switch to the "scene" sprite.
      const hot = outcome.conquest || (next.affection[table.id] ?? 0) >= 70;
      setScene({ h: table, text: outcome.scene, conquest: !!outcome.conquest, expression: hot ? "scene" : "rougit" });
    }
    setShowGifts(false);
    if (outcome.conquest) setTopic(null);
    else if (next.turnsLeft > 0) setTopic(pickTopic(next, table.id));
  }

  function reset() {
    if (confirm("Recommencer depuis le début ? Toute ta progression au Velours Noir sera perdue.")) {
      setTableId(null);
      setState(null);
    }
  }

  const nightOver = s.turnsLeft <= 0 && !scene;

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-950/60 via-[var(--ink-950)] to-rose-950/60 px-4 py-3">
        <div className="font-display text-lg font-bold text-rose-300">🍸 Le Velours Noir</div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg bg-white/5 px-2.5 py-1">🌙 Nuit {s.night}</span>
          <span className="rounded-lg bg-white/5 px-2.5 py-1">⏳ {s.turnsLeft}/{TURNS_PER_NIGHT}</span>
          <span className="rounded-lg bg-white/5 px-2.5 py-1 text-emerald-300">💶 {s.money} €</span>
          <span className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-rose-300">💘 {s.conquered.length}/{GOAL}</span>
          <button onClick={reset} className={buttonClasses("ghost", "sm")}>
            Recommencer
          </button>
        </div>
      </div>

      {!table ? (
        <Room state={s} onSit={sit} onEndNight={() => setState(nextNight(s))} />
      ) : (
        <Table
          h={table}
          state={s}
          topic={topic}
          log={log}
          expression={expression}
          showGifts={showGifts}
          setShowGifts={setShowGifts}
          apply={apply}
          onLeave={() => setTableId(null)}
          onReplay={(text, expression) => setScene({ h: table, text, expression, conquest: false, replay: true })}
        />
      )}

      {/* Scene overlay */}
      {scene && (
        <Overlay>
          <div className={`relative -mx-6 -mt-6 overflow-hidden rounded-t-2xl bg-gradient-to-b ${scene.h.gradient}`}>
            <Sprite h={scene.h} expression={scene.expression} className="mx-auto h-72 w-auto object-cover object-top" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-fuchsia-950 via-fuchsia-950/80 to-transparent px-6 pb-3 pt-10">
              <div className="font-display text-xl font-bold text-rose-200">{scene.h.name}</div>
              <div className="text-xs uppercase tracking-widest text-fuchsia-300">
                {scene.replay ? "📸 Souvenir" : scene.conquest ? "💘 Conquise" : "✨ Moment volé"}
              </div>
            </div>
          </div>
          <p className="text-[15px] italic leading-relaxed text-slate-200">{scene.text}</p>
          {scene.conquest && <p className="text-center text-2xl tracking-[0.5em] text-slate-500">· · ·</p>}
          <button
            onClick={() => {
              if (scene.conquest) setTableId(null);
              setScene(null);
            }}
            className={buttonClasses("primary", "md", "w-full")}
          >
            {scene.replay ? "Fermer" : scene.conquest ? "Au petit matin…" : "Reprendre ses esprits"}
          </button>
        </Overlay>
      )}

      {/* Victory */}
      {victory && !victorySeen && !scene && (
        <Overlay>
          <div className="text-center text-6xl">👑</div>
          <h2 className="font-display text-center text-2xl font-bold text-amber-300">Roi du Velours Noir</h2>
          <p className="text-center text-slate-300">
            Les dix dames du Velours Noir sont tombées sous ton charme en <b>{s.night}</b> nuit{s.night > 1 ? "s" : ""}.
            On parlera de toi dans ce bar pendant des années.
          </p>
          <button
            onClick={() => {
              setVictorySeen(false);
              setState(null);
            }}
            className={buttonClasses("primary", "md", "w-full")}
          >
            Nouvelle partie
          </button>
          <button onClick={() => setVictorySeen(true)} className={buttonClasses("secondary", "md", "w-full")}>
            Rester encore un peu
          </button>
        </Overlay>
      )}

      {/* Closing time */}
      {nightOver && !victory && (
        <Overlay>
          <div className="text-center text-5xl">🌅</div>
          <h2 className="font-display text-center text-xl font-bold text-rose-300">Fermeture du bar</h2>
          <p className="text-center text-sm text-slate-300">
            Les néons s&apos;éteignent. Tu rentres seul… pour cette fois. Demain, ta paie tombe : +{NIGHTLY_PAY} €.
          </p>
          <button
            onClick={() => {
              setTableId(null);
              setState(nextNight(s));
            }}
            className={buttonClasses("primary", "md", "w-full")}
          >
            Nuit suivante
          </button>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-b from-fuchsia-950 to-[var(--ink-950)] p-6 shadow-2xl shadow-fuchsia-950">
        {children}
      </div>
    </div>
  );
}

function Room({ state, onSit, onEndNight }: { state: VeloursState; onSit: (id: string) => void; onEndNight: () => void }) {
  const lockedBoss = HOSTESSES.find((h) => h.unlockAfter && state.conquered.length < h.unlockAfter);
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Ce soir, {state.present.length} hôtesses sont en service. Choisis ta table — tu peux en changer à tout moment.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state.present.map((id) => {
          const h = HOSTESS_BY_ID[id];
          const conquered = state.conquered.includes(id);
          const mood = state.moods[id] ?? 0;
          return (
            <button
              key={id}
              onClick={() => onSit(id)}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-fuchsia-400/40 hover:bg-fuchsia-500/5"
            >
              <Portrait h={h} expression={conquered ? "rougit" : "neutre"} hot={isHot(state, id)} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100">
                    {h.name} <span className="text-xs font-normal text-slate-500">{h.age} ans</span>
                  </span>
                  <span title={MOOD_LABEL[mood]}>{MOOD_ICON[mood]}</span>
                </div>
                <div className="truncate text-xs text-slate-400">{h.tagline}</div>
                <AffectionBar value={state.affection[id] ?? 0} conquered={conquered} />
              </div>
            </button>
          );
        })}
      </div>
      {lockedBoss && (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-amber-400/30 p-3 text-sm text-slate-400">
          <span className="text-2xl grayscale">👑</span>
          <span>
            Au comptoir, <b className="text-amber-300">{lockedBoss.name}</b> t&apos;observe sans un mot. Elle ne descendra
            à ta table qu&apos;après {lockedBoss.unlockAfter} conquêtes ({state.conquered.length}/{lockedBoss.unlockAfter}).
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {HOSTESSES.filter((h) => state.conquered.includes(h.id)).map((h) => (
            <span key={h.id} className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-300">
              {h.emoji} {h.name}
            </span>
          ))}
        </div>
        <button onClick={onEndNight} className={buttonClasses("secondary", "sm")}>
          Rentrer se coucher (nuit suivante)
        </button>
      </div>
    </div>
  );
}

function Table({
  h,
  state,
  topic,
  log,
  expression,
  showGifts,
  setShowGifts,
  apply,
  onLeave,
  onReplay,
}: {
  h: Hostess;
  state: VeloursState;
  topic: Topic | null;
  log: LogEntry[];
  expression: Expression;
  showGifts: boolean;
  setShowGifts: (v: boolean) => void;
  apply: (r: readonly [VeloursState, Outcome] | null, yourLine: string) => void;
  onLeave: () => void;
  onReplay: (text: string, expression: Expression) => void;
}) {
  const aff = state.affection[h.id] ?? 0;
  const conquered = state.conquered.includes(h.id);
  const mood = state.moods[h.id] ?? 0;
  const noTurns = state.turnsLeft <= 0;
  const move = MOVES[affectionTier(aff)];
  const chance = Math.round(moveChance(state, h.id) * 100);
  const seen = state.scenesSeen[h.id] ?? [];
  const souvenirs: { label: string; text: string; expression: Expression }[] = [
    ...(seen.includes(MILESTONES[0]) ? [{ label: "✨ Complice", text: h.scenes[0], expression: "rougit" as const }] : []),
    ...(seen.includes(MILESTONES[1]) ? [{ label: "🔥 Troublée", text: h.scenes[1], expression: "scene" as const }] : []),
    ...(conquered ? [{ label: "💘 L'after", text: h.scenes[2], expression: "scene" as const }] : []),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Side card */}
      <div className="space-y-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className={`-mx-4 -mt-4 w-[calc(100%+2rem)] bg-gradient-to-b ${h.gradient} opacity-95`}>
            <Sprite h={h} expression={expression} hot={isHot(state, h.id)} className="mx-auto h-auto max-h-[42vh] w-auto lg:max-h-none" />
          </div>
          <div className="font-display text-xl font-bold text-rose-200">{h.name}</div>
          <div className="text-xs text-slate-400">
            {h.age} ans · {h.tagline}
          </div>
          <div className="text-xs text-slate-500">
            {MOOD_ICON[mood]} {MOOD_LABEL[mood]}
          </div>
        </div>
        <AffectionBar value={aff} conquered={conquered} />
        {souvenirs.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-widest text-slate-500">📸 Souvenirs</div>
            <div className="flex flex-wrap gap-1.5">
              {souvenirs.map((s) => (
                <button
                  key={s.label}
                  onClick={() => onReplay(s.text, s.expression)}
                  className={buttonClasses("ghost", "sm", "border border-fuchsia-400/30 text-fuchsia-200")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <button onClick={onLeave} className={buttonClasses("secondary", "sm", "w-full")}>
          ← Retour à la salle
        </button>
      </div>

      {/* Conversation */}
      <div className="space-y-4">
        <div className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-4">
          {log.map((e, i) => (
            <div key={i} className={`flex ${e.who === "you" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  e.who === "you" ? "bg-sky-500/15 text-sky-100" : "bg-fuchsia-500/10 text-slate-200"
                }`}
              >
                {e.text}
                {e.delta !== undefined && e.delta !== 0 && (
                  <span className={`ml-2 text-xs font-bold ${e.delta > 0 ? "text-rose-300" : "text-slate-500"}`}>
                    {e.delta > 0 ? `❤ +${e.delta}` : `💔 ${e.delta}`}
                  </span>
                )}
              </div>
            </div>
          ))}
          {topic && !noTurns && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl bg-fuchsia-500/20 px-3 py-2 text-sm font-medium text-fuchsia-100">
                {topic.line}
              </div>
            </div>
          )}
        </div>

        {conquered ? (
          <p className="text-center text-sm text-slate-400">Elle est à toi. Va plutôt tenter ta chance ailleurs… 😏</p>
        ) : noTurns ? null : aff >= CONQUEST_THRESHOLD ? (
          <button
            onClick={() => apply(proposeAfter(state, h.id), "On s'éclipse ? Je connais un endroit où on sera tranquilles.")}
            className={buttonClasses("danger", "md", "w-full py-3 text-base")}
          >
            🔥 Lui proposer un after
          </button>
        ) : (
          <>
            {topic && (
              <div className="grid gap-2 sm:grid-cols-2">
                {topic.answers.map((a) => (
                  <button
                    key={a.style}
                    onClick={() => apply(answer(state, h.id, topic.id, a.style), a.text)}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left text-sm text-slate-200 transition hover:border-fuchsia-400/40 hover:bg-fuchsia-500/10"
                  >
                    <span className={`mr-1.5 text-xs font-semibold ${STYLE_META[a.style].color}`}>
                      {STYLE_META[a.style].icon} {STYLE_META[a.style].label}
                    </span>
                    <br />
                    {a.text}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {DRINKS.map((d) => (
                <button
                  key={d.id}
                  disabled={state.money < d.price}
                  onClick={() => apply(buyDrink(state, h.id, d.id), `*${d.label}.*`)}
                  className={buttonClasses("secondary", "sm")}
                >
                  {d.icon} {d.label} · {d.price} €
                </button>
              ))}
              <button onClick={() => setShowGifts(!showGifts)} className={buttonClasses("secondary", "sm")}>
                🎁 Offrir un cadeau
              </button>
              <button
                onClick={() => apply(tryMove(state, h.id), `*${move.label}.*`)}
                className={buttonClasses("danger", "sm")}
                title="Gros gain si ça passe, grosse perte sinon"
              >
                🔥 {move.label} · {chance}%
              </button>
            </div>

            {showGifts && (
              <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-2 lg:grid-cols-3">
                {GIFTS.map((g) => (
                  <button
                    key={g.id}
                    disabled={state.money < g.price}
                    onClick={() => apply(giveGift(state, h.id, g.id), `*Tu lui tends un paquet : ${g.label.toLowerCase()}.*`)}
                    className={buttonClasses("ghost", "sm", "justify-between border border-white/10")}
                  >
                    <span>
                      {g.icon} {g.label}
                      {g.spicy && <span className="ml-1 text-orange-400">🌶</span>}
                    </span>
                    <span className="text-emerald-300">{g.price} €</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
