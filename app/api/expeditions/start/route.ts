import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getZone, isZoneUnlocked } from "@/lib/game/content/zones";
import { getDifficulty, isDifficulty, isDifficultyUnlocked } from "@/lib/game/content/difficulties";
import type { Difficulty, Expedition, Hero, UserProfile } from "@/types/game";

interface Body {
  zoneId: string;
  heroIds: string[];
  difficulty?: Difficulty;
}

/** Sends a team of idle heroes into a zone's arena run (the zone, and that difficulty on it, must be unlocked). */
export const POST = withAuth(async (uid, request) => {
  const { zoneId, heroIds, difficulty: rawDifficulty } = (await request.json()) as Body;
  const zone = getZone(zoneId);
  if (rawDifficulty !== undefined && !isDifficulty(rawDifficulty)) throw new GameError("Difficulté inconnue");
  const difficulty: Difficulty = rawDifficulty ?? "normal";

  if (heroIds.length === 0) throw new GameError("Sélectionnez au moins un héros");
  if (heroIds.length > zone.heroSlots) {
    throw new GameError(`Cette zone accepte au maximum ${zone.heroSlots} héros`);
  }

  const expeditionRef = adminDb.collection("expeditions").doc();
  const startedAt = Date.now();

  await adminDb.runTransaction(async (tx) => {
    const heroRefs = heroIds.map((id) => adminDb.collection("heroes").doc(id));
    const [userSnap, ...heroSnaps] = await Promise.all([
      tx.get(adminDb.collection("users").doc(uid)),
      ...heroRefs.map((ref) => tx.get(ref)),
    ]);
    const user = userSnap.data() as UserProfile | undefined;
    if (!isZoneUnlocked(zone, user?.expeditionRecords)) {
      throw new GameError("Zone verrouillée : terminez d'abord la zone précédente");
    }
    if (!isDifficultyUnlocked(zone.id, difficulty, user?.expeditionRecords)) {
      throw new GameError(`Difficulté « ${getDifficulty(difficulty).name} » verrouillée : battez le boss dans la difficulté précédente`);
    }

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
      difficulty,
      startedAt,
      durationSec: zone.durationSec,
      status: "active",
    };
    tx.set(expeditionRef, expedition);
  });

  return NextResponse.json({ expeditionId: expeditionRef.id, startedAt, durationSec: zone.durationSec });
});
