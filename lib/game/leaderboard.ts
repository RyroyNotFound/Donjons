import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { heroPower, resolveHeroStats } from "@/lib/game/engine/stats";
import { ZONES } from "@/lib/game/content/zones";
import { CLASSES } from "@/lib/game/content/classes";
import { SPELLS } from "@/lib/game/content/spells";
import { TALENTS } from "@/lib/game/content/talents";
import { MASTERIES } from "@/lib/game/content/masteries";
import type {
  Hero,
  Item,
  LeaderboardCategory,
  LeaderboardEntry,
  LeaderboardResponse,
  UserProfile,
} from "@/types/game";

/** Power ranks a player's best team, sized like the biggest expedition party. */
export const POWER_TEAM_SIZE = Math.max(...ZONES.map((z) => z.heroSlots));
const COLLECTION_TOTAL = CLASSES.length + SPELLS.length + TALENTS.length + MASTERIES.length;
const TOP_SIZE = 50;
/** Rebuilding reads every profile/hero/equipped item, so it's shared across callers for a bit. */
const CACHE_MS = 60_000;

interface PlayerRow {
  uid: string;
  displayName: string;
  scores: Record<LeaderboardCategory, { score: number; tiebreak: number; detail: string }>;
}

let cache: { builtAt: number; rows: PlayerRow[] } | null = null;

async function loadEquippedItems(heroes: Hero[]): Promise<Map<string, Item>> {
  const ids = [...new Set(heroes.flatMap((h) => Object.values(h.equipment).filter(Boolean) as string[]))];
  const items = new Map<string, Item>();
  for (let i = 0; i < ids.length; i += 300) {
    const refs = ids.slice(i, i + 300).map((id) => adminDb.collection("items").doc(id));
    const snaps = await adminDb.getAll(...refs);
    for (const snap of snaps) if (snap.exists) items.set(snap.id, snap.data() as Item);
  }
  return items;
}

async function buildRows(): Promise<PlayerRow[]> {
  const [userSnap, heroSnap] = await Promise.all([
    adminDb.collection("users").get(),
    adminDb.collection("heroes").get(),
  ]);
  const heroes = heroSnap.docs.map((d) => d.data() as Hero);
  const items = await loadEquippedItems(heroes);

  const heroesByOwner = new Map<string, Hero[]>();
  for (const hero of heroes) {
    const list = heroesByOwner.get(hero.ownerId) ?? [];
    list.push(hero);
    heroesByOwner.set(hero.ownerId, list);
  }

  return userSnap.docs.map((doc) => {
    const profile = doc.data() as UserProfile;
    const ranks = profile.componentRanks ?? {};

    const powers = (heroesByOwner.get(profile.uid) ?? [])
      .map((hero) => {
        const equipped = Object.values(hero.equipment)
          .filter(Boolean)
          .map((id) => items.get(id as string))
          .filter((item): item is Item => Boolean(item));
        return heroPower(resolveHeroStats(hero, equipped, ranks));
      })
      .sort((a, b) => b - a);
    const teamPower = powers.slice(0, POWER_TEAM_SIZE).reduce((sum, p) => sum + p, 0);

    const records = Object.values(profile.expeditionRecords ?? {});
    const stars = records.reduce((sum, r) => sum + r.bestStars, 0);
    const clears = records.reduce((sum, r) => sum + r.clears, 0);

    const raid = profile.raidStats ?? { pvpWins: 0, botWins: 0, defenseWins: 0, lootStolen: 0 };
    const raidScore = raid.pvpWins * 3 + raid.defenseWins * 2 + raid.botWins;

    const ownedComponents = Object.values(ranks).filter((r) => r > 0);
    const owned = (profile.unlockedClasses ?? []).length + ownedComponents.length;
    const rankSum = ownedComponents.reduce((sum, r) => sum + r, 0);

    return {
      uid: profile.uid,
      displayName: profile.displayName,
      scores: {
        power: {
          score: teamPower,
          tiebreak: powers[0] ?? 0,
          detail: `${Math.min(powers.length, POWER_TEAM_SIZE)} héros`,
        },
        expeditions: {
          score: stars,
          tiebreak: clears,
          detail: `${clears} victoire${clears > 1 ? "s" : ""}`,
        },
        raids: {
          score: raidScore,
          tiebreak: raid.lootStolen,
          detail: `${raid.pvpWins} PvP · ${raid.defenseWins} déf. · ${raid.botWins} repaires`,
        },
        collection: {
          score: owned,
          tiebreak: rankSum,
          detail: `${owned}/${COLLECTION_TOTAL} · rangs cumulés ${rankSum}`,
        },
      },
    };
  });
}

function rank(rows: PlayerRow[], category: LeaderboardCategory): LeaderboardEntry[] {
  const sorted = [...rows].sort((a, b) => {
    const sa = a.scores[category];
    const sb = b.scores[category];
    return sb.score - sa.score || sb.tiebreak - sa.tiebreak || a.displayName.localeCompare(b.displayName);
  });
  return sorted.map((row, i) => ({
    rank: i + 1,
    uid: row.uid,
    displayName: row.displayName,
    score: row.scores[category].score,
    detail: row.scores[category].detail,
  }));
}

export async function getLeaderboard(uid: string): Promise<LeaderboardResponse> {
  if (!cache || Date.now() - cache.builtAt > CACHE_MS) {
    cache = { builtAt: Date.now(), rows: await buildRows() };
  }
  const categories = {} as LeaderboardResponse["categories"];
  for (const category of ["power", "expeditions", "raids", "collection"] as const) {
    const all = rank(cache.rows, category);
    categories[category] = {
      top: all.slice(0, TOP_SIZE),
      me: all.find((e) => e.uid === uid) ?? null,
    };
  }
  return { categories, playerCount: cache.rows.length, builtAt: cache.builtAt };
}
