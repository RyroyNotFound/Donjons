import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getRecipe } from "@/lib/game/content/recipes";
import type { Item, ResourceKind, UserProfile } from "@/types/game";

interface Body {
  recipeId: string;
}

/** Crafts a recipe's result item, consuming gold + resources. Resolves instantly for now. */
export const POST = withAuth(async (uid, request) => {
  const { recipeId } = (await request.json()) as Body;
  const recipe = getRecipe(recipeId);

  const userRef = adminDb.collection("users").doc(uid);
  const itemRef = adminDb.collection("items").doc();

  await adminDb.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const user = userSnap.data() as UserProfile;

    if (user.gold < recipe.cost.gold) throw new GameError("Or insuffisant");
    for (const [kind, amount] of Object.entries(recipe.cost.resources) as [
      ResourceKind,
      number,
    ][]) {
      if ((user.resources[kind] ?? 0) < amount) {
        throw new GameError(`Ressource insuffisante : ${kind}`);
      }
    }

    const nextResources = { ...user.resources };
    for (const [kind, amount] of Object.entries(recipe.cost.resources) as [
      ResourceKind,
      number,
    ][]) {
      nextResources[kind] = nextResources[kind] - amount;
    }

    tx.update(userRef, { gold: user.gold - recipe.cost.gold, resources: nextResources });

    const item: Item = {
      id: itemRef.id,
      ownerId: uid,
      name: recipe.result.name,
      slot: recipe.result.slot,
      rarity: recipe.result.rarity,
      statBonus: recipe.result.statBonus,
    };
    tx.set(itemRef, item);
  });

  return NextResponse.json({ itemId: itemRef.id });
});
