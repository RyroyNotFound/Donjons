import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { DEFAULT_UPGRADE_LEVELS, getUpgradeTrack } from "@/lib/game/content/dungeonUpgrades";
import { dungeonUpgradeCost } from "@/lib/game/dungeonEconomy";
import type { DungeonUpgradeTrackId, DungeonUpgrades, ResourceKind, UserProfile } from "@/types/game";

interface Body {
  trackId: DungeonUpgradeTrackId;
}

/** Spends resources to raise one dungeon-upgrade track by a level. */
export const POST = withAuth(async (uid, request) => {
  const { trackId } = (await request.json()) as Body;
  const track = getUpgradeTrack(trackId);

  const userRef = adminDb.collection("users").doc(uid);
  const upgradesRef = adminDb.collection("dungeonUpgrades").doc(uid);

  const newLevel = await adminDb.runTransaction(async (tx) => {
    const [userSnap, upgradesSnap] = await Promise.all([tx.get(userRef), tx.get(upgradesRef)]);
    const user = userSnap.data() as UserProfile;
    const levels = (upgradesSnap.data() as DungeonUpgrades | undefined)?.levels ?? DEFAULT_UPGRADE_LEVELS;
    const currentLevel = levels[trackId] ?? 0;

    if (currentLevel >= track.maxLevel) throw new GameError("Filière déjà au niveau maximum");

    const cost = dungeonUpgradeCost(trackId, currentLevel);
    for (const [kind, amount] of Object.entries(cost) as [ResourceKind, number][]) {
      if ((user.resources[kind] ?? 0) < amount) {
        throw new GameError(`Ressource insuffisante : ${kind}`);
      }
    }

    const nextResources = { ...user.resources };
    for (const [kind, amount] of Object.entries(cost) as [ResourceKind, number][]) {
      nextResources[kind] = nextResources[kind] - amount;
    }
    tx.update(userRef, { resources: nextResources });

    const nextLevels = { ...levels, [trackId]: currentLevel + 1 };
    tx.set(
      upgradesRef,
      { ownerId: uid, levels: nextLevels, updatedAt: Date.now() },
      { merge: true },
    );

    return currentLevel + 1;
  });

  return NextResponse.json({ ok: true, trackId, level: newLevel });
});
