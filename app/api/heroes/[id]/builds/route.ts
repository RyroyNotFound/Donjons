import { NextResponse } from "next/server";
import { SPELL_SLOTS, MASTERY_SLOTS } from "@/lib/game/economy";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { MAX_SHARED_BUILDS, sharedBuilds } from "@/lib/game/builds";
import type { Hero, HeroBuild, UserProfile } from "@/types/game";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type Body =
  | { action: "save"; name: string }
  | { action: "apply"; buildId: string }
  | { action: "delete"; buildId: string };

/** Saves (from this hero), applies (to this hero) or deletes a named "ensemble": a snapshot of
 *  class + equipped spells/masteries. Ensembles belong to the account (`UserProfile.builds`) and
 *  can be applied to any hero. Talent point investment is never part of an ensemble — see
 *  TalentNode.classId doc comment. */
export const POST = withAuth<RouteContext>(async (uid, request, { params }) => {
  const { id: heroId } = await params;
  const body = (await request.json()) as Body;

  const heroRef = adminDb.collection("heroes").doc(heroId);
  const userRef = adminDb.collection("users").doc(uid);
  const [heroSnap, userSnap] = await Promise.all([heroRef.get(), userRef.get()]);
  if (!heroSnap.exists) throw new GameError("Héros introuvable");
  const hero = heroSnap.data() as Hero;
  if (hero.ownerId !== uid) throw new GameError("Ce héros ne vous appartient pas");
  const user = userSnap.data() as UserProfile;

  // First use after ensembles became shared: fold every hero's old list into the account's.
  let builds = user.builds;
  if (!builds) {
    const heroesSnap = await adminDb.collection("heroes").where("ownerId", "==", uid).get();
    builds = sharedBuilds(null, heroesSnap.docs.map((d) => d.data() as Hero));
  }

  if (body.action === "save") {
    const name = String(body.name ?? "").trim().slice(0, 40);
    if (!name) throw new GameError("Nom d'ensemble requis");
    if (builds.length >= MAX_SHARED_BUILDS) {
      throw new GameError(`Nombre d'ensembles maximum atteint (${MAX_SHARED_BUILDS})`);
    }
    const build: HeroBuild = {
      id: crypto.randomUUID(),
      name,
      classId: hero.classId,
      equippedSpellIds: hero.equippedSpellIds,
      equippedMasteryIds: hero.equippedMasteryIds,
    };
    await userRef.update({ builds: [...builds, build] });
    return NextResponse.json({ ok: true, build });
  }

  if (body.action === "delete") {
    await userRef.update({ builds: builds.filter((b) => b.id !== body.buildId) });
    return NextResponse.json({ ok: true });
  }

  // apply
  if (hero.status !== "idle") throw new GameError(`${hero.name} n'est pas disponible en ce moment`);
  const build = builds.find((b) => b.id === body.buildId);
  if (!build) throw new GameError("Ensemble introuvable");
  if (build.classId && !user.unlockedClasses.includes(build.classId)) {
    throw new GameError("Cette classe n'est pas débloquée sur ce compte");
  }
  const owned = (id: string) => (user.componentRanks[id] ?? 0) > 0;

  // Spells work regardless of class, so applying an ensemble never needs to drop any of them.
  await heroRef.update({
    classId: build.classId ?? null,
    equippedSpellIds: build.equippedSpellIds.filter(owned).slice(0, SPELL_SLOTS),
    equippedMasteryIds: build.equippedMasteryIds.filter(owned).slice(0, MASTERY_SLOTS),
  });
  if (!user.builds) await userRef.update({ builds });

  return NextResponse.json({ ok: true });
});
