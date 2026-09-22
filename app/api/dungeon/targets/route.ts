import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/api/handler";
import type { Dungeon, UserProfile } from "@/types/game";

/** Lists other players' configured dungeons as possible attack targets. */
export const GET = withAuth(async (uid) => {
  const snap = await adminDb
    .collection("dungeons")
    .where("pointsSpent", ">", 0)
    .limit(20)
    .get();

  const others = snap.docs
    .map((d) => d.data() as Dungeon)
    .filter((d) => d.ownerId !== uid);

  const profiles = await Promise.all(
    others.map((d) => adminDb.collection("users").doc(d.ownerId).get()),
  );

  const targets = others.map((dungeon, i) => {
    const profile = profiles[i].data() as UserProfile | undefined;
    return {
      ownerId: dungeon.ownerId,
      displayName: profile?.displayName ?? "Aventurier inconnu",
      roomCount: dungeon.rooms.filter((r) => r.kind !== "empty").length,
      hasBoss: Boolean(dungeon.bossRefId),
      pointsSpent: dungeon.pointsSpent,
    };
  });

  return NextResponse.json({ targets });
});
