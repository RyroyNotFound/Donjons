import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getZone } from "@/lib/game/content/zones";
import type { Expedition, Hero } from "@/types/game";

interface Body {
  zoneId: string;
  heroIds: string[];
}

/** Sends a team of idle heroes to farm a zone for `zone.durationSec`. */
export const POST = withAuth(async (uid, request) => {
  const { zoneId, heroIds } = (await request.json()) as Body;
  const zone = getZone(zoneId);

  if (heroIds.length === 0) throw new GameError("Sélectionnez au moins un héros");
  if (heroIds.length > zone.heroSlots) {
    throw new GameError(`Cette zone accepte au maximum ${zone.heroSlots} héros`);
  }

  const expeditionRef = adminDb.collection("expeditions").doc();
  const startedAt = Date.now();

  await adminDb.runTransaction(async (tx) => {
    const heroRefs = heroIds.map((id) => adminDb.collection("heroes").doc(id));
    const heroSnaps = await Promise.all(heroRefs.map((ref) => tx.get(ref)));

    for (const snap of heroSnaps) {
      if (!snap.exists) throw new GameError("Héros introuvable");
      const hero = snap.data() as Hero;
      if (hero.ownerId !== uid) throw new GameError("Ce héros ne vous appartient pas");
      if (hero.status !== "idle") throw new GameError(`${hero.name} n'est pas disponible`);
    }

    for (const ref of heroRefs) {
      tx.update(ref, { status: "expedition" });
    }

    const expedition: Expedition = {
      id: expeditionRef.id,
      ownerId: uid,
      zoneId,
      heroIds,
      startedAt,
      durationSec: zone.durationSec,
      status: "active",
    };
    tx.set(expeditionRef, expedition);
  });

  return NextResponse.json({ expeditionId: expeditionRef.id, startedAt, durationSec: zone.durationSec });
});
