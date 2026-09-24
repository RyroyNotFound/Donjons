import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { getRecipe, RECIPES } from "@/lib/game/content/recipes";
import { CRAFT_RARITY_WEIGHTS, rollItem, rollRarity } from "@/lib/game/engine/items";
import { randomInt } from "@/lib/game/engine/rng";
import {
  applyTavernAmount,
  canAffordOffer,
  currentTavernSlot,
  offerBlockedReason,
  RANDOM_ITEM_RARITY_WEIGHTS,
  tavernNpcFor,
  tavernStateFor,
} from "@/lib/game/tavern";
import type { Item, UserProfile } from "@/types/game";

interface Body {
  slot: number;
  offerId: string;
}

/** Takes one of the current tavern visitor's offers: pays its cost, then grants its reward
 *  (bets: only if the server-side roll wins). A `randomGoldCost` offer rolls its secret price
 *  here, from the gold the player has at that moment. */
export const POST = withAuth(async (uid, request) => {
  const { slot, offerId } = (await request.json()) as Body;
  const currentSlot = currentTavernSlot(Date.now());
  if (slot !== currentSlot) throw new GameError("Ce visiteur est déjà parti — un autre a pris sa place.");

  const npc = tavernNpcFor(uid, currentSlot);
  const offer = npc.offers?.find((o) => o.id === offerId);
  if (!offer) throw new GameError("Offre introuvable");

  const won = offer.winChance === undefined || Math.random() < offer.winChance;

  let item: Item | null = null;
  const itemRef = adminDb.collection("items").doc();
  if (won && (offer.reward.item || offer.reward.randomItem)) {
    const recipe = offer.reward.item
      ? getRecipe(offer.reward.item.recipeId)
      : RECIPES[randomInt(Math.random, 0, RECIPES.length - 1)];
    const rarity =
      offer.reward.item?.rarity ??
      rollRarity(Math.random, offer.reward.randomItem ? RANDOM_ITEM_RARITY_WEIGHTS : CRAFT_RARITY_WEIGHTS[recipe.tier]);
    const rolled = rollItem(Math.random, {
      baseName: recipe.result.name,
      slot: recipe.result.slot,
      tier: recipe.tier,
      baseStats: recipe.result.statBonus,
      rarity,
    });
    item = { id: itemRef.id, ownerId: uid, ...rolled, enhanceLevel: 0 };
  }

  const userRef = adminDb.collection("users").doc(uid);
  let paidGold: number | null = null;
  await adminDb.runTransaction(async (tx) => {
    const user = (await tx.get(userRef)).data() as UserProfile;
    const state = tavernStateFor(user, currentSlot);

    const blocked = offerBlockedReason(npc, offer, state.claimedOfferIds);
    if (blocked) throw new GameError(blocked);
    if (!canAffordOffer(user, offer)) throw new GameError("Vous n'avez pas de quoi payer.");

    const cost = { ...offer.cost };
    if (offer.randomGoldCost) {
      paidGold = randomInt(Math.random, 1, user.gold);
      cost.gold = (cost.gold ?? 0) + paidGold;
    }
    const afterCost = { ...user, ...applyTavernAmount(user, cost, -1) };
    const afterReward = won ? applyTavernAmount(afterCost, offer.reward, 1) : afterCost;

    tx.update(userRef, {
      gold: afterReward.gold,
      crystals: afterReward.crystals,
      rankTokens: afterReward.rankTokens,
      forgeShards: afterReward.forgeShards,
      resources: afterReward.resources,
      tavern: {
        ...state,
        claimedOfferIds: [...state.claimedOfferIds, offer.id],
        metNpcIds: state.metNpcIds.includes(npc.id) ? state.metNpcIds : [...state.metNpcIds, npc.id],
      },
    });
    if (item) tx.set(itemRef, item);
  });

  return NextResponse.json({ won, item, paidGold });
});
