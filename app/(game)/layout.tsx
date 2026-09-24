"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useGameData } from "@/lib/game/GameDataProvider";
import { Spinner } from "@/components/Spinner";
import { buttonClasses, PRIMARY_GRADIENT } from "@/components/Button";
import { ResourcePill } from "@/components/ResourcePill";
import { Icon } from "@/components/Icon";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { focusRing } from "@/lib/ui/a11y";
import type { IconName } from "@/lib/ui/icons";

type NavLink = { href: string; label: string; icon: string; iconName?: IconName };
type NavGroup = { title?: string; links: NavLink[] };

const NAV_GROUPS: NavGroup[] = [
  {
    links: [{ href: "/tableau-de-bord", label: "Tableau de bord", icon: "🏰" }],
  },
  {
    title: "Héros",
    links: [
      { href: "/heros", label: "Mes héros", icon: "🧙" },
      { href: "/heros/inventaire", label: "Inventaire", icon: "🎒" },
      { href: "/gacha", label: "Invocation", icon: "🔮" },
      { href: "/forge", label: "Forge", icon: "🔨" },
    ],
  },
  {
    title: "Donjon",
    links: [
      { href: "/donjon", label: "Mon donjon", icon: "🛡️", iconName: "shield" },
      { href: "/donjon/ameliorations", label: "Améliorations", icon: "🛠️" },
      { href: "/donjon/attaquer", label: "Attaquer", icon: "⚔️", iconName: "sword" },
    ],
  },
  {
    title: "Aventure",
    links: [
      { href: "/expeditions", label: "Expéditions", icon: "🗺️", iconName: "scroll" },
      { href: "/taverne", label: "Taverne", icon: "🍺" },
      { href: "/velours", label: "Velours Noir", icon: "🍸" },
    ],
  },
  {
    title: "Social",
    links: [{ href: "/classement", label: "Classement", icon: "🏆" }],
  },
];

const ALL_HREFS = NAV_GROUPS.flatMap((g) => g.links.map((l) => l.href));

/** Longest nav href prefixing the current path, so sub-pages (/heros/123, /donjon/attaquer/raid/…) keep their entry lit. */
function activeHref(pathname: string): string | undefined {
  return ALL_HREFS.filter((href) => pathname === href || pathname.startsWith(href + "/")).sort(
    (a, b) => b.length - a.length,
  )[0];
}

function NavContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const current = activeHref(pathname);
  return (
    <div className="space-y-5">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.title ?? i}>
          {group.title && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              {group.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.links.map((link) => {
              const active = link.href === current;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${focusRing} ${
                      active ? PRIMARY_GRADIENT : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="flex w-5 justify-center" aria-hidden>
                      {link.iconName ? <Icon name={link.iconName} className="h-4 w-4" /> : link.icon}
                    </span>
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function BurgerIcon({ close = false }: { close?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" d={close ? "M6 6l12 12M18 6L6 18" : "M4 6h16M4 12h16M4 18h16"} />
    </svg>
  );
}

export default function GameLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { profile, error: loadError, errorDetail, retry } = useGameData();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/connexion");
  }, [loading, user, router]);

  // While the mobile drawer is open: Escape closes it and the page behind doesn't scroll.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  if (loading || !user) {
    return <Spinner label="Chargement..." />;
  }

  const logout = () => signOut(auth);

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="max-w-md text-slate-300">{loadError}</p>
        {errorDetail && <p className="font-mono text-xs text-slate-500">{errorDetail}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={retry} className={buttonClasses("primary")}>
            Réessayer
          </button>
          <button type="button" onClick={logout} className={buttonClasses("ghost")}>
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // A brand-new account has no profile until /api/bootstrap creates it: wait instead of
  // flashing an empty game before the onboarding kicks in.
  if (!profile) {
    return <Spinner label="Préparation de votre donjon..." />;
  }

  if (!profile.onboardedAt) {
    return <Onboarding profile={profile} />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <header
        className="sticky top-0 z-20 border-b border-white/10 bg-[var(--ink-950)]/85 backdrop-blur-md"
        style={{ viewTransitionName: "site-header" } as React.CSSProperties}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Ouvrir le menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-nav"
              className={`-ml-1 rounded-lg p-2 text-slate-200 hover:bg-white/5 lg:hidden ${focusRing}`}
            >
              <BurgerIcon />
            </button>
            <Link href="/tableau-de-bord" className="font-display text-gold-gradient text-lg font-bold tracking-wide">
              ⚔️ Donjons
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <div className="flex items-center gap-1.5">
                <ResourcePill icon="gold" label="Or" value={profile.gold} colorClassName="text-amber-300" />
                <ResourcePill icon="crystal" label="Cristaux" value={profile.crystals ?? 0} colorClassName="text-sky-300" />
                <ResourcePill
                  icon="wood"
                  label="Bois"
                  value={profile.resources.wood ?? 0}
                  colorClassName="text-emerald-300"
                  hiddenOnMobile
                />
                <ResourcePill
                  icon="ore"
                  label="Minerai"
                  value={profile.resources.ore ?? 0}
                  colorClassName="text-slate-300"
                  hiddenOnMobile
                />
                <ResourcePill
                  icon="essence"
                  label="Essence"
                  value={profile.resources.essence ?? 0}
                  colorClassName="text-purple-300"
                  hiddenOnMobile
                />
              </div>
            )}
            <button onClick={logout} className={buttonClasses("ghost", "sm", "hidden border border-white/10 lg:inline-flex")}>
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Mobile / tablet drawer */}
      <div className={`fixed inset-0 z-30 lg:hidden ${drawerOpen ? "" : "pointer-events-none"}`} aria-hidden={!drawerOpen}>
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${drawerOpen ? "opacity-100" : "opacity-0"}`}
        />
        <nav
          id="mobile-nav"
          aria-label="Navigation principale"
          inert={!drawerOpen}
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-white/10 bg-[var(--ink-900)] shadow-2xl transition-transform duration-200 ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
            <span className="font-display text-gold-gradient text-lg font-bold tracking-wide">⚔️ Donjons</span>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Fermer le menu"
              className={`rounded-lg p-2 text-slate-300 hover:bg-white/5 ${focusRing}`}
            >
              <BurgerIcon close />
            </button>
          </div>
          <div className="panel-scrollbar flex-1 overflow-y-auto p-3">
            <NavContent pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </div>
          <div className="border-t border-white/10 p-3">
            <button onClick={logout} className={buttonClasses("ghost", "sm", "w-full border border-white/10")}>
              Déconnexion
            </button>
          </div>
        </nav>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4">
        {/* Desktop sidebar */}
        <nav
          aria-label="Navigation principale"
          className="panel-scrollbar sticky top-14 hidden max-h-[calc(100dvh-3.5rem)] w-52 shrink-0 self-start overflow-y-auto py-8 lg:block"
        >
          <NavContent pathname={pathname} />
        </nav>
        <main className="min-w-0 flex-1 py-8">{children}</main>
      </div>
    </div>
  );
}
