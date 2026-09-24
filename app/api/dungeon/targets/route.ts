import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/api/handler";
import { BOT_DUNGEONS } from "@/lib/game/content/botDungeons";
import { dungeonDefenseLevel } from "@/lib/game/content/dungeonUpgrades";
import { dungeonIntel, type DungeonIntel } from "@/lib/game/dungeonIntel";
import type { Dungeon, Hero, UserProfile } from "@/types/game";

export interface DungeonTarget {
  defenderId: string;
  displayName: string;
  roomCount: number;
  treasureRoomCount: number;
  pointsSpent: number;
  isBot: boolean;
  intel: DungeonIntel;
  /** Bots only: what the dungeon teaches the attacker to prepare for. */
  hint?: string;
  /** Player dungeons already conquered today (a new conquest pays no crystals until tomorrow). */
  conqueredToday?: boolean;
}

/** How many player dungeons one list shows, and how wide the level window around the attacker is. */
const PLAYER_TARGETS = 12;
const LEVEL_WINDOW_BELOW = 8;
const LEVEL_WINDOW_ABOVE = 12;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Lists the bot dungeons plus a fresh random pick of other players' dungeons near the attacker's
 *  level (each call reshuffles), each with a scouting report. */
export const GET = withAuth(async (uid) => {
  const [meSnap, myHeroesSnap] = await Promise.all([
    adminDb.collection("users").doc(uid).get(),
    adminDb.collection("heroes").where("ownerId", "==", uid).get(),
  ]);
  const me = meSnap.data() as UserProfile | undefined;
  const myLevel = dungeonDefenseLevel(myHeroesSnap.docs.map((d) => d.data() as Hero).filter((h) => h.classId).map((h) => h.level));
  const today = new Date().toISOString().slice(0, 10);

  // Level-matched pool first; widen to any dungeon when the window is too empty (small player base,
  // or dungeons saved before defenseLevel existed).
  const matched = await adminDb
    .collection("dungeons")
    .where("defenseLevel", ">=", Math.max(1, myLevel - LEVEL_WINDOW_BELOW))
    .where("defenseLevel", "<=", myLevel + LEVEL_WINDOW_ABOVE)
    .limit(100)
    .get();
  let pool = matched.docs.map((d) => d.data() as Dungeon).filter((d) => d.ownerId !== uid && d.treasureRoomCount > 0);
  if (pool.length < PLAYER_TARGETS) {
    const any = await adminDb.collection("dungeons").where("treasureRoomCount", ">", 0).limit(100).get();
    const seen = new Set(pool.map((d) => d.ownerId));
    pool = [...pool, ...shuffle(any.docs.map((d) => d.data() as Dungeon)).filter((d) => d.ownerId !== uid && !seen.has(d.ownerId))];
  }
  const picked = shuffle(pool.slice(0, 100)).slice(0, PLAYER_TARGETS);

  const profiles = await Promise.all(picked.map((d) => adminDb.collection("users").doc(d.ownerId).get()));

  const playerTargets: DungeonTarget[] = picked.map((dungeon, i) => {
    const profile = profiles[i].data() as UserProfile | undefined;
    return {
      defenderId: dungeon.ownerId,
      displayName: profile?.displayName ?? "Aventurier inconnu",
      roomCount: dungeon.roomCount,
      treasureRoomCount: dungeon.treasureRoomCount,
      pointsSpent: dungeon.pointsSpent,
      isBot: false,
      intel: dungeonIntel(dungeon),
      conqueredToday: me?.raidConquests?.[dungeon.ownerId] === today,
    };
  });

  const botTargets: DungeonTarget[] = BOT_DUNGEONS.map((bot) => ({
    defenderId: `bot:${bot.id}`,
    displayName: bot.name,
    roomCount: bot.rooms.length - 1,
    treasureRoomCount: bot.rooms.filter((r) => r.type === "treasure").length,
    pointsSpent: bot.tier * 10,
    isBot: true,
    intel: dungeonIntel({ rooms: bot.rooms, garrisonHeroIds: [], defenseLevel: bot.defenseLevel }),
    hint: bot.hint,
  }));

  return NextResponse.json({ targets: [...botTargets, ...playerTargets], myLevel });
});
