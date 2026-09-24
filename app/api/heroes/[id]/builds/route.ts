import { NextResponse } from "next/server";
import { SPELL_SLOTS } from "@/lib/game/economy";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import type { Hero, HeroBuild } from "@/types/game";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type Body =
  | { action: "save"; name: string }
  | { action: "apply"; buildId: string }
  | { action: "delete"; buildId: string };

const MAX_BUILDS = 6;

/** Saves, applies or deletes a named "ensemble" (build): a snapshot of class + equipped spells/masteries.
 *  Talent point investment is never part of a build — see TalentNode.classId doc comment. */
export const POST = withAuth<RouteContext>(async (uid, request, { params }) => {
  const { id: heroId } = await params;
  const body = (await request.json()) as Body;

  const heroRef = adminDb.collection("heroes").doc(heroId);
  const heroSnap = await heroRef.get();
  if (!heroSnap.exists) throw new GameError("Héros introuvable");
  const hero = heroSnap.data() as Hero;
  if (hero.ownerId !== uid) throw new GameError("Ce héros ne vous appartient pas");

  if (body.action === "save") {
    if (!body.name.trim()) throw new GameError("Nom d'ensemble requis");
    if (hero.builds.length >= MAX_BUILDS) throw new GameError(`Nombre d'ensembles maximum atteint (${MAX_BUILDS})`);
    const build: HeroBuild = {
      id: crypto.randomUUID(),
      name: body.name.trim().slice(0, 40),
      classId: hero.classId,
      equippedSpellIds: hero.equippedSpellIds,
      equippedMasteryIds: hero.equippedMasteryIds,
    };
    await heroRef.update({ builds: [...hero.builds, build] });
    return NextResponse.json({ ok: true, build });
  }

  if (body.action === "delete") {
    await heroRef.update({ builds: hero.builds.filter((b) => b.id !== body.buildId) });
    return NextResponse.json({ ok: true });
  }

  // apply
  if (hero.status !== "idle") throw new GameError(`${hero.name} n'est pas disponible en ce moment`);
  const build = hero.builds.find((b) => b.id === body.buildId);
  if (!build) throw new GameError("Ensemble introuvable");

  // Spells work regardless of class, so applying a build never needs to drop any of them.
  await heroRef.update({
    classId: build.classId ?? null,
    equippedSpellIds: build.equippedSpellIds.slice(0, SPELL_SLOTS),
    equippedMasteryIds: build.equippedMasteryIds,
  });

  return NextResponse.json({ ok: true });
});
