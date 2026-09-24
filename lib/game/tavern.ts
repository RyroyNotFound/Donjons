// Client-safe tavern rules (no server-only imports): which NPC is visiting, whether an offer
// can still be taken, and how a cost/reward changes a profile. The page and the API route
// both use these so they always agree on who's at the counter.

import { TAVERN_NPCS } from "@/lib/game/content/tavern";
import { createRng } from "@/lib/game/engine/rng";
import type {
  ItemRarity,
  ResourceKind,
  TavernAmount,
  TavernNpc,
  TavernNpcRarity,
  TavernOffer,
  TavernState,
  UserProfile,
} from "@/types/game";

/** A new visitor walks in every 30 minutes. */
export const TAVERN_ROTATION_MS = 30 * 60 * 1000;

export const NPC_RARITY_WEIGHT: Record<TavernNpcRarity, number> = {
  commun: 10,
  rare: 4,
  legendaire: 1,
};

export function currentTavernSlot(now: number): number {
  return Math.floor(now / TAVERN_ROTATION_MS);
}

export function slotEndsAt(slot: number): number {
  return (slot + 1) * TAVERN_ROTATION_MS;
}

const TOTAL_WEIGHT = TAVERN_NPCS.reduce((sum, npc) => sum + NPC_RARITY_WEIGHT[npc.rarity], 0);

/** Weighted pick seeded by player + slot, so each player gets their own rotation. */
function rawPickIndex(uid: string, slot: number): number {
  let roll = createRng(`tavern:${uid}:${slot}`)() * TOTAL_WEIGHT;
  for (let i = 0; i < TAVERN_NPCS.length; i++) {
    roll -= NPC_RARITY_WEIGHT[TAVERN_NPCS[i].rarity];
    if (roll < 0) return i;
  }
  return TAVERN_NPCS.length - 1;
}

/** Re-rolls when the pick matches the previous slot's. Looking back a few slots is enough to make
 *  a back-to-back repeat practically impossible without an unbounded recursion. */
function pickIndex(uid: string, slot: number, lookBack: number): number {
  const index = rawPickIndex(uid, slot);
  if (lookBack === 0) return index;
  return index === pickIndex(uid, slot - 1, lookBack - 1) ? (index + 1) % TAVERN_NPCS.length : index;
}

/** The NPC visiting `uid`'s tavern during `slot`. Never the same one twice in a row. */
export function tavernNpcFor(uid: string, slot: number): TavernNpc {
  return TAVERN_NPCS[pickIndex(uid, slot, 4)];
}

/** The profile's tavern state for `slot` — claims from an older slot don't carry over. */
export function tavernStateFor(profile: Pick<UserProfile, "tavern">, slot: number): TavernState {
  const state = profile.tavern;
  return {
    slot,
    claimedOfferIds: state?.slot === slot ? state.claimedOfferIds : [],
    metNpcIds: state?.metNpcIds ?? [],
  };
}

/** Why `offer` can't be taken right now, or null if it can. */
export function offerBlockedReason(npc: TavernNpc, offer: TavernOffer, claimedOfferIds: string[]): string | null {
  if (claimedOfferIds.includes(offer.id)) return "Déjà pris";
  if (npc.offerMode === "pickOne" && claimedOfferIds.length > 0) return "Choix déjà fait";
  return null;
}

const RESOURCE_KINDS: ResourceKind[] = ["wood", "ore", "essence"];

export function canAffordTavern(profile: UserProfile, cost: TavernAmount | undefined): boolean {
  if (!cost) return true;
  if ((cost.gold ?? 0) > profile.gold) return false;
  if ((cost.crystals ?? 0) > (profile.crystals ?? 0)) return false;
  if ((cost.rankTokens ?? 0) > (profile.rankTokens ?? 0)) return false;
  if ((cost.forgeShards ?? 0) > (profile.forgeShards ?? 0)) return false;
  return RESOURCE_KINDS.every((kind) => (cost.resources?.[kind] ?? 0) <= (profile.resources[kind] ?? 0));
}

export function canAffordOffer(profile: UserProfile, offer: TavernOffer): boolean {
  if (offer.randomGoldCost && profile.gold < 1) return false;
  return canAffordTavern(profile, offer.cost);
}

/** Odds for a `randomItem` reward — the gods don't care about recipe tiers. */
export const RANDOM_ITEM_RARITY_WEIGHTS: Record<ItemRarity, number> = {
  commun: 40,
  rare: 32,
  epique: 20,
  legendaire: 8,
};

/** Profile fields after adding `amount` times `sign` (+1 reward, -1 cost). */
export function applyTavernAmount(
  profile: UserProfile,
  amount: TavernAmount | undefined,
  sign: 1 | -1,
): Pick<UserProfile, "gold" | "crystals" | "rankTokens" | "forgeShards" | "resources"> {
  const resources = { ...profile.resources };
  for (const kind of RESOURCE_KINDS) {
    resources[kind] = (resources[kind] ?? 0) + sign * (amount?.resources?.[kind] ?? 0);
  }
  return {
    gold: profile.gold + sign * (amount?.gold ?? 0),
    crystals: (profile.crystals ?? 0) + sign * (amount?.crystals ?? 0),
    rankTokens: (profile.rankTokens ?? 0) + sign * (amount?.rankTokens ?? 0),
    forgeShards: (profile.forgeShards ?? 0) + sign * (amount?.forgeShards ?? 0),
    resources,
  };
}

const RESOURCE_LABEL: Record<ResourceKind, string> = { wood: "bois", ore: "minerai", essence: "essence" };

/** "120 or, 2 💎, 5 minerai" — for offer cards and result messages. */
export function formatTavernAmount(amount: TavernAmount | undefined): string {
  if (!amount) return "";
  const parts: string[] = [];
  if (amount.gold) parts.push(`${amount.gold} or`);
  if (amount.crystals) parts.push(`${amount.crystals} 💎`);
  if (amount.rankTokens) parts.push(`${amount.rankTokens} jeton${amount.rankTokens > 1 ? "s" : ""} de rang`);
  if (amount.forgeShards) parts.push(`${amount.forgeShards} éclats de forge`);
  for (const kind of RESOURCE_KINDS) {
    const value = amount.resources?.[kind];
    if (value) parts.push(`${value} ${RESOURCE_LABEL[kind]}`);
  }
  return parts.join(", ");
}
