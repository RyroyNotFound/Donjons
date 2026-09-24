import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/api/handler";
import { currentTavernSlot, tavernNpcFor, tavernStateFor } from "@/lib/game/tavern";
import type { UserProfile } from "@/types/game";

/** Records the current visitor in the player's codex (and resets claims from an older window). */
export const POST = withAuth(async (uid) => {
  const slot = currentTavernSlot(Date.now());
  const npc = tavernNpcFor(uid, slot);
  const userRef = adminDb.collection("users").doc(uid);

  await adminDb.runTransaction(async (tx) => {
    const user = (await tx.get(userRef)).data() as UserProfile;
    const state = tavernStateFor(user, slot);
    if (user.tavern?.slot === slot && state.metNpcIds.includes(npc.id)) return;
    tx.update(userRef, {
      tavern: {
        ...state,
        metNpcIds: state.metNpcIds.includes(npc.id) ? state.metNpcIds : [...state.metNpcIds, npc.id],
      },
    });
  });

  return NextResponse.json({ npcId: npc.id, slot });
});
