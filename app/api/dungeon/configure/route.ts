import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import {
  DUNGEON_POINT_BUDGET,
  DUNGEON_ROOM_COUNT,
  getMonster,
  getTrap,
} from "@/lib/game/content/dungeon";
import type { DungeonRoomSlot } from "@/types/game";

interface Body {
  rooms: DungeonRoomSlot[];
  bossRefId?: string;
}

/** Saves the caller's dungeon layout after validating the point budget and referenced content. */
export const POST = withAuth(async (uid, request) => {
  const { rooms, bossRefId } = (await request.json()) as Body;

  if (rooms.length !== DUNGEON_ROOM_COUNT) {
    throw new GameError(`Le donjon doit avoir exactement ${DUNGEON_ROOM_COUNT} salles`);
  }

  let pointsSpent = 0;
  for (const room of rooms) {
    if (room.kind === "empty") continue;
    if (!room.refId) throw new GameError("Salle mal configurée");
    if (room.kind === "trap") pointsSpent += getTrap(room.refId).cost;
    if (room.kind === "monster") pointsSpent += getMonster(room.refId).cost;
  }

  if (bossRefId) {
    const boss = getMonster(bossRefId);
    if (!boss.isBoss) throw new GameError("Ce monstre ne peut pas être boss");
  }

  if (pointsSpent > DUNGEON_POINT_BUDGET) {
    throw new GameError(
      `Budget dépassé : ${pointsSpent}/${DUNGEON_POINT_BUDGET} points`,
    );
  }

  await adminDb.collection("dungeons").doc(uid).set({
    ownerId: uid,
    rooms,
    bossRefId: bossRefId ?? null,
    pointsSpent,
    updatedAt: Date.now(),
  });

  return NextResponse.json({ ok: true, pointsSpent });
});
