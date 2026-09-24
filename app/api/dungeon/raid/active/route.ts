import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/api/handler";
import { toRaidView } from "@/lib/game/engine/dungeonRaid";
import type { DungeonRaid } from "@/types/game";

/** Returns the caller's in-progress raid, if any — lets the raid page resume after a page refresh. */
export const GET = withAuth(async (uid) => {
  const snap = await adminDb
    .collection("dungeonRaids")
    .where("attackerId", "==", uid)
    .where("status", "==", "in_progress")
    .limit(1)
    .get();

  if (snap.empty) return NextResponse.json({ view: null });

  const raid = snap.docs[0].data() as DungeonRaid;
  return NextResponse.json({ view: toRaidView(raid) });
});
