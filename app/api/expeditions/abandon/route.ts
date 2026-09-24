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
  await adminDb.runTransaction(async (tx) => {
    const expeditionSnap = await tx.get(expeditionRef);
    if (!expeditionSnap.exists) throw new GameError("Expédition introuvable");
    const expedition = expeditionSnap.data() as Expedition;

    if (expedition.ownerId !== uid) throw new GameError("Cette expédition ne vous appartient pas");
    if (expedition.status !== "active") throw new GameError("Expédition déjà terminée");

    // Heroes wiped by a legacy account reset may no longer exist.
    const heroRefs = expedition.heroIds.map((heroId) => adminDb.collection("heroes").doc(heroId));
    const heroSnaps = heroRefs.length ? await tx.getAll(...heroRefs) : [];

    tx.update(expeditionRef, { status: "claimed" });
    for (const snap of heroSnaps) {
      if (snap.exists) tx.update(snap.ref, { status: "idle" });
    }
  });

  return NextResponse.json({ ok: true });
});
