import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { createRng } from "@/lib/game/engine/rng";
import { applyMove, toRaidView } from "@/lib/game/engine/dungeonRaid";
import { finalizeRaid } from "@/lib/game/dungeonRaidLifecycle";
import type { DungeonRaid } from "@/types/game";

interface Body {
  raidId: string;
  row: number;
  col: number;
}

/** Moves the attacker into an adjacent room and resolves whatever's in it: trap, monster fight, or treasure. */
export const POST = withAuth(async (uid, request) => {
  const { raidId, row, col } = (await request.json()) as Body;
  const raidRef = adminDb.collection("dungeonRaids").doc(raidId);
  const raidSnap = await raidRef.get();
  if (!raidSnap.exists) throw new GameError("Raid introuvable");
  const raid = raidSnap.data() as DungeonRaid;
  if (raid.attackerId !== uid) throw new GameError("Ce raid ne vous appartient pas");

  const rng = createRng(`${raid.seed}:${raid.log.length}:${row}:${col}`);
  const { raid: nextRaid, newLog } = applyMove(raid, { row, col }, rng);

  await raidRef.set(nextRaid);
  const crystalsEarned = nextRaid.status !== "in_progress" ? await finalizeRaid(nextRaid) : undefined;

  return NextResponse.json({ ...toRaidView(nextRaid, newLog), crystalsEarned });
});
