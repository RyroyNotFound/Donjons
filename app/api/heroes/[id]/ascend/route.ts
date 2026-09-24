import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { MAX_STAR_RANK, rankUpCost } from "@/lib/game/economy";
import type { Hero, UserProfile } from "@/types/game";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Spends rank tokens + gold to raise a hero's star rank by one. */
export const POST = withAuth<RouteContext>(async (uid, _request, { params }) => {
  const { id: heroId } = await params;
  const heroRef = adminDb.collection("heroes").doc(heroId);
  const userRef = adminDb.collection("users").doc(uid);

  await adminDb.runTransaction(async (tx) => {
    const heroSnap = await tx.get(heroRef);
    if (!heroSnap.exists) throw new GameError("Héros introuvable");
    const hero = heroSnap.data() as Hero;
    if (hero.ownerId !== uid) throw new GameError("Ce héros ne vous appartient pas");
    if (!hero.classId) throw new GameError("Ce héros n'a pas encore de classe assignée");

    const currentStar = hero.starRank ?? 1;
    if (currentStar >= MAX_STAR_RANK) throw new GameError("Rang maximum déjà atteint");

    const cost = rankUpCost(currentStar);
    const userSnap = await tx.get(userRef);
    const user = userSnap.data() as UserProfile;
    if (user.rankTokens < cost.rankTokens) throw new GameError(`Jetons de rang insuffisants (${cost.rankTokens} requis)`);
    if (user.gold < cost.gold) throw new GameError(`Or insuffisant (${cost.gold} requis)`);

    tx.update(userRef, {
      gold: user.gold - cost.gold,
      rankTokens: user.rankTokens - cost.rankTokens,
    });
    tx.update(heroRef, { starRank: currentStar + 1 });
  });

  return NextResponse.json({ ok: true });
});
