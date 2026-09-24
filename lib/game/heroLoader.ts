import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { heroPower, resolveHeroStats } from "@/lib/game/engine/stats";
import type { Hero, HeroStats, Item, UserProfile } from "@/types/game";

export interface ResolvedHero {
  hero: Hero;
  stats: HeroStats;
}

/** Loads the given heroes (must belong to `uid`) with their equipment-resolved combat stats,
 *  scaled by `uid`'s gacha-earned spell/talent/mastery ranks. */
export async function loadOwnedHeroesWithStats(
  uid: string,
  heroIds: string[],
): Promise<ResolvedHero[]> {
  if (heroIds.length === 0) return [];

  const [heroSnaps, ownerSnap] = await Promise.all([
    Promise.all(heroIds.map((id) => adminDb.collection("heroes").doc(id).get())),
    adminDb.collection("users").doc(uid).get(),
  ]);
  const componentRanks = (ownerSnap.data() as UserProfile | undefined)?.componentRanks ?? {};

  const heroes: Hero[] = [];
  for (const snap of heroSnaps) {
    if (!snap.exists) throw new Error("Héros introuvable");
    const hero = snap.data() as Hero;
    if (hero.ownerId !== uid) throw new Error("Un héros sélectionné ne vous appartient pas");
    heroes.push(hero);
  }

  const itemIds = heroes.flatMap((h) => Object.values(h.equipment).filter(Boolean)) as string[];
  const itemSnaps = itemIds.length
    ? await Promise.all(itemIds.map((id) => adminDb.collection("items").doc(id).get()))
    : [];
  const itemsById = new Map<string, Item>();
  for (const snap of itemSnaps) {
    if (snap.exists) itemsById.set(snap.id, snap.data() as Item);
  }

  return heroes.map((hero) => {
    const equippedItems = Object.values(hero.equipment)
      .filter(Boolean)
      .map((itemId) => itemsById.get(itemId as string))
      .filter((item): item is Item => Boolean(item));
    return { hero, stats: resolveHeroStats(hero, equippedItems, componentRanks) };
  });
}

export function teamPower(resolved: ResolvedHero[]): number {
  return resolved.reduce((sum, { stats }) => sum + heroPower(stats), 0);
}
