import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import type { Expedition } from "@/types/game";

interface Body {
  expeditionId: string;
}

/** Cancels an active expedition with no loot: frees the heroes and closes the record. */
export const POST = withAuth(async (uid, request) => {
  const { expeditionId } = (await request.json()) as Body;
  const expeditionRef = adminDb.collection("expeditions").doc(expeditionId);
  const expeditionSnap = await expeditionRef.get();
  if (!expeditionSnap.exists) throw new GameError("Expédition introuvable");
  const expedition = expeditionSnap.data() as Expedition;

  if (expedition.ownerId !== uid) throw new GameError("Cette expédition ne vous appartient pas");
  if (expedition.status !== "active") throw new GameError("Expédition déjà terminée");

  const batch = adminDb.batch();
  batch.update(expeditionRef, { status: "claimed" });
  for (const heroId of expedition.heroIds) {
    batch.update(adminDb.collection("heroes").doc(heroId), { status: "idle" });
  }
  await batch.commit();

  return NextResponse.json({ ok: true });
});
