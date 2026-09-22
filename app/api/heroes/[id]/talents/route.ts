import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getSubclass } from "@/lib/game/content/classes";
import type { Hero } from "@/types/game";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface Body {
  nodeId: string;
}

/** Spends one talent point on a node, respecting max rank, prerequisites and available points. */
export const POST = withAuth<RouteContext>(async (uid, request, { params }) => {
  const { id: heroId } = await params;
  const { nodeId } = (await request.json()) as Body;

  const heroRef = adminDb.collection("heroes").doc(heroId);
  const heroSnap = await heroRef.get();
  if (!heroSnap.exists) throw new GameError("Héros introuvable");
  const hero = heroSnap.data() as Hero;
  if (hero.ownerId !== uid) throw new GameError("Ce héros ne vous appartient pas");

  const subclass = getSubclass(hero.subclassId);
  const node = subclass.talentTree.find((n) => n.id === nodeId);
  if (!node) throw new GameError("Talent inconnu");

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
