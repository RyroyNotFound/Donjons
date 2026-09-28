import type { NavIconName } from "@/components/NavIcon";

export type NavLink = { href: string; label: string; icon: NavIconName };
export type NavGroup = { title: string; links: NavLink[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Camp",
    links: [{ href: "/tableau-de-bord", label: "Tableau de bord", icon: "home" }],
  },
  {
    title: "Héros",
    links: [
      { href: "/heros", label: "Mes héros", icon: "heroes" },
      { href: "/heros/inventaire", label: "Inventaire", icon: "backpack" },
      { href: "/gacha", label: "Invocation", icon: "summon" },
      { href: "/forge", label: "Forge", icon: "forge" },
    ],
  },
  {
    title: "Donjon",
    links: [
      { href: "/donjon", label: "Mon donjon", icon: "dungeon" },
      { href: "/donjon/ameliorations", label: "Améliorations", icon: "upgrade" },
      { href: "/donjon/attaquer", label: "Attaquer", icon: "attack" },
    ],
  },
  {
    title: "Aventure",
    links: [
      { href: "/aventure", label: "Mode aventure", icon: "compass" },
      { href: "/expeditions", label: "Expéditions", icon: "map" },
      { href: "/taverne", label: "Taverne", icon: "tavern" },
      { href: "/velours", label: "Velours Noir", icon: "velvet" },
    ],
  },
  {
    title: "Social",
    links: [{ href: "/classement", label: "Classement", icon: "trophy" }],
  },
];

/** Mobile tab bar: the four most-used destinations; everything else lives in the menu sheet. */
export const TAB_LINKS: (NavLink & { group: string })[] = [
  { href: "/tableau-de-bord", label: "Camp", icon: "home", group: "Camp" },
  { href: "/heros", label: "Héros", icon: "heroes", group: "Héros" },
  { href: "/donjon", label: "Donjon", icon: "dungeon", group: "Donjon" },
  { href: "/expeditions", label: "Aventure", icon: "compass", group: "Aventure" },
];

const ALL_LINKS = NAV_GROUPS.flatMap((g) => g.links.map((l) => ({ ...l, group: g.title })));

/** Longest nav href prefixing the current path, so sub-pages (/heros/123, /donjon/attaquer/raid/…) keep their entry lit. */
export function activeNavLink(pathname: string) {
  return ALL_LINKS.filter((l) => pathname === l.href || pathname.startsWith(l.href + "/")).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}
