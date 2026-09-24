import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getClass } from "@/lib/game/content/classes";
import type { Hero, UserProfile } from "@/types/game";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface Body {
  classId: string;
}

/** Assigns or switches a hero's class. Talent investment in other classes stays banked (dormant) and
 *  reappears if that class is picked again later. Equipped spells are never dropped on a class switch —
 *  spells work on any class, a matching class just makes them stronger. */
export const POST = withAuth<RouteContext>(async (uid, request, { params }) => {
  const { id: heroId } = await params;
  const { classId } = (await request.json()) as Body;
  getClass(classId); // throws if unknown

  const heroRef = adminDb.collection("heroes").doc(heroId);
  const userRef = adminDb.collection("users").doc(uid);
  const [heroSnap, userSnap] = await Promise.all([heroRef.get(), userRef.get()]);
  if (!heroSnap.exists) throw new GameError("Héros introuvable");
  const hero = heroSnap.data() as Hero;
  if (hero.ownerId !== uid) throw new GameError("Ce héros ne vous appartient pas");
  if (hero.status !== "idle") throw new GameError(`${hero.name} n'est pas disponible en ce moment`);

  const user = userSnap.data() as UserProfile;
  if (!user.unlockedClasses.includes(classId)) {
    throw new GameError("Vous n'avez pas encore obtenu cette classe (invocation)");
  }

  await heroRef.update({ classId });

  return NextResponse.json({ ok: true });
});
