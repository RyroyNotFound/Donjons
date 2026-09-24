import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { cleanPlayerName, heroNameError } from "@/lib/game/playerName";
import type { Hero } from "@/types/game";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface Body {
  name: string;
}

/** Renames a hero. Allowed whatever the hero is doing: a raid already in progress keeps the old
 *  name in its frozen snapshot. */
export const POST = withAuth<RouteContext>(async (uid, request, { params }) => {
  const { id: heroId } = await params;
  const { name: raw } = (await request.json()) as Body;
  const name = cleanPlayerName(String(raw ?? ""));
  const invalid = heroNameError(name);
  if (invalid) throw new GameError(invalid);

  const heroRef = adminDb.collection("heroes").doc(heroId);
  const heroSnap = await heroRef.get();
  if (!heroSnap.exists) throw new GameError("Héros introuvable");
  const hero = heroSnap.data() as Hero;
  if (hero.ownerId !== uid) throw new GameError("Ce héros ne vous appartient pas");

  await heroRef.update({ name });
  return NextResponse.json({ ok: true, name });
});
