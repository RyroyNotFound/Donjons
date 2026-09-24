import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getTalent } from "@/lib/game/content/talents";
import type { Hero, UserProfile } from "@/types/game";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface Body {
  nodeId: string;
}

/** Spends talent points on a node, respecting ownership (gacha-unlocked), the active class,
 *  max rank, star rank and available points. `requires` is not enforced: owned nodes are random
 *  gacha pulls, so a missing prerequisite used to lock a node for good. */
export const POST = withAuth<RouteContext>(async (uid, request, { params }) => {
  const { id: heroId } = await params;
  const { nodeId } = (await request.json()) as Body;

  const heroRef = adminDb.collection("heroes").doc(heroId);
  const userRef = adminDb.collection("users").doc(uid);
  const [heroSnap, userSnap] = await Promise.all([heroRef.get(), userRef.get()]);
  if (!heroSnap.exists) throw new GameError("Héros introuvable");
  const hero = heroSnap.data() as Hero;
  if (hero.ownerId !== uid) throw new GameError("Ce héros ne vous appartient pas");
  if (!hero.classId) throw new GameError("Ce héros n'a pas encore de classe assignée");

  const node = getTalent(nodeId);
  if (node.classId !== hero.classId) throw new GameError("Ce talent n'appartient pas à la classe active");

  const user = userSnap.data() as UserProfile;
  if ((user.componentRanks[nodeId] ?? 0) <= 0) {
    throw new GameError("Vous n'avez pas encore obtenu ce talent (invocation)");
  }

  const currentRank = hero.talents[nodeId] ?? 0;
  if (currentRank >= node.maxRank) throw new GameError("Rang maximum déjà atteint");
  if (hero.talentPoints < node.cost) throw new GameError("Points de talent insuffisants");
  if (node.requires && !(hero.talents[node.requires] > 0)) {
    throw new GameError("Prérequis manquant");
  }
  if (node.requiresStarRank && (hero.starRank ?? 1) < node.requiresStarRank) {
    throw new GameError(`Nécessite ${node.requiresStarRank}★`);
  }

  const updatedTalents = { ...hero.talents, [nodeId]: currentRank + 1 };
  const updatedPoints = hero.talentPoints - node.cost;

  await heroRef.update({ talents: updatedTalents, talentPoints: updatedPoints });

  return NextResponse.json({
    hero: { ...hero, talents: updatedTalents, talentPoints: updatedPoints },
  });
});
