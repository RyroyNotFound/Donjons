import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { toRaidView } from "@/lib/game/engine/dungeonRaid";
import { commitRaidStep } from "@/lib/game/dungeonRaidLifecycle";
import type { DungeonRaid } from "@/types/game";

interface Body {
  raidId: string;
}

/** Ends the raid voluntarily, banking whatever loot was already secured from reached treasure rooms. */
export const POST = withAuth(async (uid, request) => {
  const { raidId } = (await request.json()) as Body;
  const raidRef = adminDb.collection("dungeonRaids").doc(raidId);
  const raidSnap = await raidRef.get();
  if (!raidSnap.exists) throw new GameError("Raid introuvable");
  const raid = raidSnap.data() as DungeonRaid;
  if (raid.attackerId !== uid) throw new GameError("Ce raid ne vous appartient pas");
  if (raid.status !== "in_progress") throw new GameError("Ce raid est déjà terminé");

  const nextRaid: DungeonRaid = { ...raid, status: "fled", updatedAt: Date.now() };
  await commitRaidStep(raidRef, raid, nextRaid);

  return NextResponse.json(toRaidView(nextRaid));
});
