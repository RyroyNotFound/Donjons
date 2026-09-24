import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/api/handler";
import { BOT_DUNGEONS } from "@/lib/game/content/botDungeons";
import type { Dungeon, UserProfile } from "@/types/game";

export interface DungeonTarget {
  defenderId: string;
  displayName: string;
  roomCount: number;
  treasureRoomCount: number;
  pointsSpent: number;
  isBot: boolean;
}

/** Lists bot dungeons plus other players' configured dungeons as possible raid targets. */
export const GET = withAuth(async (uid) => {
  const snap = await adminDb.collection("dungeons").where("treasureRoomCount", ">", 0).limit(20).get();

  const others = snap.docs.map((d) => d.data() as Dungeon).filter((d) => d.ownerId !== uid);

  const profiles = await Promise.all(
    others.map((d) => adminDb.collection("users").doc(d.ownerId).get()),
  );

  const playerTargets: DungeonTarget[] = others.map((dungeon, i) => {
    const profile = profiles[i].data() as UserProfile | undefined;
    return {
      defenderId: dungeon.ownerId,
      displayName: profile?.displayName ?? "Aventurier inconnu",
      roomCount: dungeon.roomCount,
      treasureRoomCount: dungeon.treasureRoomCount,
      pointsSpent: dungeon.pointsSpent,
      isBot: false,
    };
  });

  const botTargets: DungeonTarget[] = BOT_DUNGEONS.map((bot) => ({
    defenderId: `bot:${bot.id}`,
    displayName: bot.name,
    roomCount: bot.rooms.length - 1,
    treasureRoomCount: bot.rooms.filter((r) => r.type === "treasure").length,
    pointsSpent: bot.tier * 10,
    isBot: true,
  }));

  return NextResponse.json({ targets: [...botTargets, ...playerTargets] });
});
