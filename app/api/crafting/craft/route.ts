import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getRecipe } from "@/lib/game/content/recipes";
import { CRAFT_RARITY_WEIGHTS, rollItem, rollRarity } from "@/lib/game/engine/items";
import type { Item, ResourceKind, UserProfile } from "@/types/game";

interface Body {
  recipeId: string;
}

/** Crafts a recipe's result item, consuming gold + resources. The item's rarity and affixes are
 *  rolled from the recipe's tier (see lib/game/engine/items.ts). Resolves instantly for now. */
export const POST = withAuth(async (uid, request) => {
  const { recipeId } = (await request.json()) as Body;
  const recipe = getRecipe(recipeId);

  const userRef = adminDb.collection("users").doc(uid);
  const itemRef = adminDb.collection("items").doc();

  const rarity = rollRarity(Math.random, CRAFT_RARITY_WEIGHTS[recipe.tier]);
  const rolled = rollItem(Math.random, {
    baseName: recipe.result.name,
    slot: recipe.result.slot,
    tier: recipe.tier,
    baseStats: recipe.result.statBonus,
    rarity,
  });
  const item: Item = { id: itemRef.id, ownerId: uid, ...rolled, enhanceLevel: 0 };

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
    tx.set(itemRef, item);
  });

  return NextResponse.json({ item });
});
