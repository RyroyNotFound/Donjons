import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { GameError, withAuth } from "@/lib/api/handler";
import { cleanPlayerName, playerNameError, playerNameKey } from "@/lib/game/playerName";
import type { UserProfile } from "@/types/game";

/**
 * Finishes the first-login intro: sets the player's chosen name and marks the
 * profile as onboarded. Names are unique (case/accent-insensitive), enforced by
 * a `displayNames/{key}` reservation doc owned by the player.
 */
export const POST = withAuth(async (uid, request) => {
  const body = (await request.json().catch(() => ({}))) as { displayName?: unknown };
  const displayName = cleanPlayerName(typeof body.displayName === "string" ? body.displayName : "");
  const invalid = playerNameError(displayName);
  if (invalid) throw new GameError(invalid);

  const key = playerNameKey(displayName);
  const userRef = adminDb.collection("users").doc(uid);
  const nameRef = adminDb.collection("displayNames").doc(key);

  await adminDb.runTransaction(async (tx) => {
    const [userSnap, nameSnap] = await Promise.all([tx.get(userRef), tx.get(nameRef)]);
    if (!userSnap.exists) throw new GameError("Profil introuvable, recharge la page.");
    if (nameSnap.exists && nameSnap.data()?.uid !== uid) {
      throw new GameError("Ce pseudo est déjà pris.");
    }

    const user = userSnap.data() as UserProfile;
    const previousKey = user.displayNameKey;
    if (previousKey && previousKey !== key) tx.delete(adminDb.collection("displayNames").doc(previousKey));

    tx.set(nameRef, { uid, displayName, updatedAt: Date.now() });
    tx.update(userRef, {
      displayName,
      displayNameKey: key,
      onboardedAt: user.onboardedAt ?? Date.now(),
    } satisfies Partial<UserProfile>);
  });

  return NextResponse.json({ displayName });
});
