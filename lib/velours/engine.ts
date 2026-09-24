// Rules for "Le Velours Noir". Pure functions over a plain state object, persisted in localStorage.

import {
  CONQUEST_THRESHOLD,
  DRINKS,
  GIFTS,
  HOSTESSES,
  HOSTESS_BY_ID,
  MILESTONES,
  MOVES,
  TOPICS,
  affectionTier,
  type GiftId,
  type Style,
  type Topic,
} from "./content";

export const TURNS_PER_NIGHT = 8;
export const STARTING_MONEY = 600;
export const NIGHTLY_PAY = 300;
export const PRESENT_PER_NIGHT = 6;
export const GOAL = 10;

const SAVE_KEY = "velours-noir-save-v1";

export type Mood = -1 | 0 | 1;

export interface VeloursState {
  night: number;
  turnsLeft: number;
  money: number;
  affection: Record<string, number>;
  conquered: string[];
  /** Milestone thresholds whose scene was already played, per hostess. */
  scenesSeen: Record<string, number[]>;
  present: string[];
  moods: Record<string, Mood>;
  lastTopic: Record<string, string>;
}

/** Result of an action, for the UI to display. */
export interface Outcome {
  line: string;
  delta: number;
  /** Scene text unlocked by crossing a milestone (or the final after). */
  scene?: string;
  conquest?: boolean;
}

const rand = (n: number) => Math.floor(Math.random() * n);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rollNight(conquered: string[]): Pick<VeloursState, "present" | "moods"> {
  const available = HOSTESSES.filter((h) => !h.unlockAfter || conquered.length >= h.unlockAfter);
  // Always seat unconquered hostesses first so the endgame never stalls on a lineup full of conquests.
  const pending = shuffle(available.filter((h) => !conquered.includes(h.id)));
  const done = shuffle(available.filter((h) => conquered.includes(h.id)));
  // The boss is always there once unlocked.
  const boss = pending.filter((h) => h.unlockAfter);
  const others = pending.filter((h) => !h.unlockAfter);
  const present = [...boss, ...others, ...done].slice(0, PRESENT_PER_NIGHT).map((h) => h.id);
  const moods: Record<string, Mood> = {};
  for (const id of present) moods[id] = (rand(3) - 1) as Mood;
  return { present, moods };
}

export function newGame(): VeloursState {
  return {
    night: 1,
    turnsLeft: TURNS_PER_NIGHT,
    money: STARTING_MONEY,
    affection: Object.fromEntries(HOSTESSES.map((h) => [h.id, 0])),
    conquered: [],
    scenesSeen: {},
    lastTopic: {},
    ...rollNight([]),
  };
}

export function loadGame(): VeloursState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as VeloursState) : null;
  } catch {
    return null;
  }
}

export function saveGame(state: VeloursState | null) {
  try {
    if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    // Private mode / blocked storage: the run just won't persist.
  }
}

export function nextNight(state: VeloursState): VeloursState {
  return {
    ...state,
    night: state.night + 1,
    turnsLeft: TURNS_PER_NIGHT,
    money: state.money + NIGHTLY_PAY,
    ...rollNight(state.conquered),
  };
}

export function pickTopic(state: VeloursState, hostessId: string): Topic {
  const tier = affectionTier(state.affection[hostessId] ?? 0);
  const pool = TOPICS.filter((t) => t.tier === tier && t.id !== state.lastTopic[hostessId]);
  const topic = pool[rand(pool.length)];
  return { ...topic, answers: shuffle(topic.answers) };
}

/** Applies an affection delta, handling mood, difficulty and milestone scenes. */
function applyAffection(
  state: VeloursState,
  hostessId: string,
  rawDelta: number,
  line: string,
): [VeloursState, Outcome] {
  const h = HOSTESS_BY_ID[hostessId];
  const mood = state.moods[hostessId] ?? 0;
  const delta =
    rawDelta > 0 ? Math.max(1, Math.round(rawDelta * h.difficulty + mood * 2)) : Math.round(rawDelta);
  const before = state.affection[hostessId] ?? 0;
  const after = Math.max(0, Math.min(CONQUEST_THRESHOLD, before + delta));
  const seen = state.scenesSeen[hostessId] ?? [];
  const crossed = MILESTONES.find((m) => before < m && after >= m && !seen.includes(m));
  const next: VeloursState = {
    ...state,
    turnsLeft: state.turnsLeft - 1,
    affection: { ...state.affection, [hostessId]: after },
    scenesSeen: crossed ? { ...state.scenesSeen, [hostessId]: [...seen, crossed] } : state.scenesSeen,
  };
  const scene = crossed !== undefined ? h.scenes[MILESTONES.indexOf(crossed)] : undefined;
  return [next, { line, delta: after - before, scene }];
}

export function answer(state: VeloursState, hostessId: string, topicId: string, style: Style) {
  const h = HOSTESS_BY_ID[hostessId];
  const pref = h.prefs[style];
  const raw = pref > 0 ? pref * 4 + rand(3) : pref === 0 ? 1 + rand(2) : pref * 5;
  const [next, outcome] = applyAffection(state, hostessId, raw, h.reactions[style]);
  return [{ ...next, lastTopic: { ...next.lastTopic, [hostessId]: topicId } }, outcome] as const;
}

export function buyDrink(state: VeloursState, hostessId: string, drinkId: (typeof DRINKS)[number]["id"]) {
  const drink = DRINKS.find((d) => d.id === drinkId)!;
  if (state.money < drink.price) return null;
  const h = HOSTESS_BY_ID[hostessId];
  const raw = drink.base + h.prefs.flambe * drink.flambeWeight;
  const line =
    raw >= drink.base + 3
      ? `*Ses yeux brillent en voyant arriver ${drink.id === "champagne" ? "la bouteille" : "la coupe"}.* Tu sais parler aux femmes, toi.`
      : raw <= 1
        ? "*Elle trempe à peine les lèvres.* Merci. C'est… gentil."
        : "*Elle trinque avec toi, le regard pétillant.* À nous.";
  const [next, outcome] = applyAffection({ ...state, money: state.money - drink.price }, hostessId, raw, line);
  return [next, outcome] as const;
}

export function giveGift(state: VeloursState, hostessId: string, giftId: GiftId) {
  const gift = GIFTS.find((g) => g.id === giftId)!;
  if (state.money < gift.price) return null;
  const h = HOSTESS_BY_ID[hostessId];
  const favorite = h.favoriteGift === giftId;
  const tooSoon = gift.spicy && !favorite && (state.affection[hostessId] ?? 0) < MILESTONES[0];
  const raw = favorite ? 22 : tooSoon ? -10 : 5 + Math.max(0, h.prefs.flambe) * 2;
  const line = favorite
    ? `*Elle ouvre le paquet et reste bouche bée.* ${gift.label}… Comment tu as deviné ? *Elle t'embrasse sur la joue, tout près des lèvres.*`
    : tooSoon
      ? `*Elle referme la boîte, glaciale.* ${gift.label} ? On se connaît à peine. Tu me prends pour qui ?`
      : `*Elle sourit poliment.* ${gift.label}. C'est gentil, merci.`;
  const [next, outcome] = applyAffection({ ...state, money: state.money - gift.price }, hostessId, raw, line);
  return [next, outcome] as const;
}

export function moveChance(state: VeloursState, hostessId: string): number {
  const h = HOSTESS_BY_ID[hostessId];
  const chance = 0.2 + (state.affection[hostessId] ?? 0) / 130 + h.prefs.audace * 0.08 + (state.moods[hostessId] ?? 0) * 0.05;
  return Math.max(0.05, Math.min(0.95, chance));
}

export function tryMove(state: VeloursState, hostessId: string) {
  const move = MOVES[affectionTier(state.affection[hostessId] ?? 0)];
  const success = Math.random() < moveChance(state, hostessId);
  return applyAffection(state, hostessId, success ? 14 : -12, success ? move.success : move.fail);
}

export function proposeAfter(state: VeloursState, hostessId: string): [VeloursState, Outcome] {
  const h = HOSTESS_BY_ID[hostessId];
  return [
    { ...state, turnsLeft: state.turnsLeft - 1, conquered: [...state.conquered, hostessId] },
    { line: "*Elle attrape son manteau et glisse sa main dans la tienne.* On y va.", delta: 0, scene: h.scenes[2], conquest: true },
  ];
}
