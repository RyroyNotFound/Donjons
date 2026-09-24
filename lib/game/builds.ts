import type { Hero, HeroBuild, UserProfile } from "@/types/game";

/** Most "ensembles" an account can keep (shared by all its heroes). */
export const MAX_SHARED_BUILDS = 12;

/** The account's shared ensembles. Before they were shared, each hero kept its own list
 *  (`Hero.builds`): until the account saves its first shared list, those are merged (deduped by
 *  id) so nobody loses a saved ensemble. The per-hero lists are never deleted. */
export function sharedBuilds(profile: Pick<UserProfile, "builds"> | null | undefined, heroes: Pick<Hero, "builds">[]): HeroBuild[] {
  if (profile?.builds) return profile.builds;
  const seen = new Set<string>();
  const merged: HeroBuild[] = [];
  for (const hero of heroes) {
    for (const build of hero.builds ?? []) {
      if (seen.has(build.id)) continue;
      seen.add(build.id);
      merged.push(build);
    }
  }
  return merged;
}
