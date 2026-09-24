import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { tryGetSpell } from "@/lib/game/content/spells";
import { getMastery } from "@/lib/game/content/masteries";
import { SPELL_SLOTS, MASTERY_SLOTS } from "@/lib/game/economy";
import type { Hero, UserProfile } from "@/types/game";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface Body {
  kind: "spell" | "mastery";
  refId: string;
  equip: boolean;
}

/** Equips or unequips a gacha-unlocked spell or mastery into one of a hero's loadout slots. */
export const POST = withAuth<RouteContext>(async (uid, request, { params }) => {
  const { id: heroId } = await params;
  const { kind, refId, equip } = (await request.json()) as Body;

  const heroRef = adminDb.collection("heroes").doc(heroId);
  const userRef = adminDb.collection("users").doc(uid);
  const [heroSnap, userSnap] = await Promise.all([heroRef.get(), userRef.get()]);
  if (!heroSnap.exists) throw new GameError("Héros introuvable");
  const hero = heroSnap.data() as Hero;
  if (hero.ownerId !== uid) throw new GameError("Ce héros ne vous appartient pas");

  const user = userSnap.data() as UserProfile;

  if (kind === "spell") {
    const spell = tryGetSpell(refId);
    if (!spell) throw new GameError("Sort inconnu");
    if ((user.componentRanks[refId] ?? 0) <= 0) {
      throw new GameError("Vous n'avez pas encore obtenu ce sort (invocation)");
    }
    // Spells work on any hero regardless of class — a class match is a bonus, not a
    // requirement (see RAID_MAGNITUDE / CLASS_MATCH_WEIGHT), so no class-lock check here.

    const current = hero.equippedSpellIds;
    if (equip) {
      if (current.includes(refId)) return NextResponse.json({ ok: true });
      if (current.length >= SPELL_SLOTS) throw new GameError(`Emplacements de sorts pleins (${SPELL_SLOTS} max)`);
      await heroRef.update({ equippedSpellIds: [...current, refId] });
    } else {
      await heroRef.update({ equippedSpellIds: current.filter((id) => id !== refId) });
    }
  } else {
    getMastery(refId); // throws if unknown
    if ((user.componentRanks[refId] ?? 0) <= 0) {
      throw new GameError("Vous n'avez pas encore obtenu cette maîtrise (invocation)");
    }

    const current = hero.equippedMasteryIds;
    if (equip) {
      if (current.includes(refId)) return NextResponse.json({ ok: true });
      if (current.length >= MASTERY_SLOTS) throw new GameError(`Emplacements de maîtrises pleins (${MASTERY_SLOTS} max)`);
      await heroRef.update({ equippedMasteryIds: [...current, refId] });
    } else {
      await heroRef.update({ equippedMasteryIds: current.filter((id) => id !== refId) });
    }
  }

  return NextResponse.json({ ok: true });
});
