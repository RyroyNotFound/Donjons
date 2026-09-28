"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useGameData } from "@/lib/game/GameDataProvider";
import { Spinner } from "@/components/Spinner";
import { buttonClasses } from "@/components/Button";
import { ResourcePill } from "@/components/ResourcePill";
import { NavIcon } from "@/components/NavIcon";
import { BrandMark } from "@/components/BrandMark";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { focusRing } from "@/lib/ui/a11y";
import { NAV_GROUPS, TAB_LINKS, activeNavLink } from "@/lib/ui/nav";

/** Routes that need the whole screen (real-time mini-game): no tab bar. */
const IMMERSIVE_PREFIXES = ["/expeditions/jouer/"];

function SidebarNav({ pathname }: { pathname: string }) {
  const current = activeNavLink(pathname)?.href;
  return (
    <div className="space-y-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-faint">
            {group.title}
          </p>
          <ul className="space-y-px">
            {group.links.map((link) => {
              const active = link.href === current;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-[background-color,color] duration-150 ease-out ${focusRing} ${
                      active
                        ? "bg-white/[0.06] font-medium text-fg"
                        : "text-fg-muted hover:bg-white/[0.035] hover:text-fg"
                    }`}
                  >
                    {active && (
                      <span aria-hidden className="absolute inset-y-2 -left-3 w-0.5 rounded-full bg-gold" />
                    )}
                    <NavIcon
                      name={link.icon}
                      className={`h-[18px] w-[18px] shrink-0 transition-colors duration-150 ${
                        active ? "text-gold" : "text-fg-subtle group-hover:text-fg-muted"
                      }`}
                    />
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

/** Bottom sheet holding the full nav on mobile. Drag the handle down (or flick) to dismiss. */
function MenuSheet({
  open,
  onClose,
  pathname,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  onLogout: () => void;
}) {
  const current = activeNavLink(pathname)?.href;
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startTime: number; dy: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (drag.current) return; // ignore extra fingers mid-drag
    drag.current = { startY: e.clientY, startTime: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const sheet = sheetRef.current;
    if (!d || !sheet) return;
    const raw = e.clientY - d.startY;
    // Dragging up past the rest position gets heavy friction instead of a hard stop.
    d.dy = raw < 0 ? -Math.sqrt(-raw) * 2 : raw;
    sheet.style.transform = `translateY(${d.dy}px)`;
  }

  function onPointerUp() {
    const d = drag.current;
    const sheet = sheetRef.current;
    drag.current = null;
    if (!d || !sheet) return;
    sheet.style.transition = "";
    sheet.style.transform = "";
    const velocity = d.dy / Math.max(1, performance.now() - d.startTime);
    if (d.dy > 90 || velocity > 0.11) onClose();
  }

  return (
    <div className={`fixed inset-0 z-40 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity ease-out ${
          open ? "opacity-100 duration-300" : "opacity-0 duration-200"
        }`}
      />
      <div
        ref={sheetRef}
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        className={`absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-line-strong bg-surface shadow-[0_-24px_48px_-12px_rgb(0_0_0/0.6)] transition-transform ${
          open ? "translate-y-0 duration-[420ms] ease-drawer" : "translate-y-full duration-200 ease-out"
        }`}
      >
        <div
          className="flex shrink-0 touch-none cursor-grab items-center justify-between px-5 pb-2 pt-3"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span aria-hidden className="absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-full bg-white/15" />
          <BrandMark />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className={`-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-fg-muted transition-[transform,background-color] duration-150 ease-out hover:bg-white/5 active:scale-[0.94] ${focusRing}`}
          >
            <NavIcon name="close" />
          </button>
        </div>
        <nav aria-label="Navigation principale" className="panel-scrollbar flex-1 overflow-y-auto px-4 pb-2">
          <div className="space-y-5 pt-2">
            {NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-faint">
                  {group.title}
                </p>
                <ul className="grid grid-cols-2 gap-2">
                  {group.links.map((link) => {
                    const active = link.href === current;
                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={onClose}
                          aria-current={active ? "page" : undefined}
                          className={`flex h-12 items-center gap-2.5 rounded-xl border px-3 text-sm transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.97] ${focusRing} ${
                            active
                              ? "border-gold/30 bg-gold/[0.08] font-medium text-fg"
                              : "border-line bg-white/[0.02] text-fg-muted"
                          }`}
                        >
                          <NavIcon
                            name={link.icon}
                            className={`h-[18px] w-[18px] shrink-0 ${active ? "text-gold" : "text-fg-subtle"}`}
                          />
                          <span className="truncate">{link.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
        <div className="shrink-0 border-t border-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <button onClick={onLogout} className={buttonClasses("secondary", "md", "w-full")}>
            <NavIcon name="logout" className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}

function TabBar({ pathname, menuOpen, onMenu }: { pathname: string; menuOpen: boolean; onMenu: () => void }) {
  const group = activeNavLink(pathname)?.group;
  // Anything outside the four tabs (Social, …) lights the Menu tab instead.
  const inTabs = TAB_LINKS.some((t) => t.group === group);
  return (
    <nav
      aria-label="Navigation rapide"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/90 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl lg:hidden"
      style={{ viewTransitionName: "site-tabbar" } as React.CSSProperties}
    >
      <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-md grid-cols-5">
        {TAB_LINKS.map((tab) => {
          const active = !menuOpen && tab.group === group;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`group flex h-full flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors duration-150 ${focusRing} ${
                  active ? "text-gold" : "text-fg-subtle"
                }`}
              >
                <NavIcon
                  name={tab.icon}
                  className="h-[22px] w-[22px] transition-transform duration-150 ease-out group-active:scale-90"
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onMenu}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className={`group flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors duration-150 ${focusRing} ${
              menuOpen || !inTabs ? "text-gold" : "text-fg-subtle"
            }`}
          >
            <NavIcon name="menu" className="h-[22px] w-[22px] transition-transform duration-150 ease-out group-active:scale-90" />
            Menu
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default function GameLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { profile, error: loadError, errorDetail, retry } = useGameData();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const immersive = IMMERSIVE_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!loading && !user) router.replace("/connexion");
  }, [loading, user, router]);

  // While the mobile menu is open: Escape closes it and the page behind doesn't scroll.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (loading || !user) {
    return <Spinner label="Chargement..." />;
  }

  const logout = () => signOut(auth);

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="max-w-md text-fg-muted">{loadError}</p>
        {errorDetail && <p className="font-mono text-xs text-fg-faint">{errorDetail}</p>}
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
        className="sticky top-0 z-20 border-b border-line bg-canvas/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl"
        style={{ viewTransitionName: "site-header" } as React.CSSProperties}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 lg:px-6">
          <Link href="/tableau-de-bord" aria-label="Donjons — tableau de bord" className={`rounded-lg ${focusRing}`}>
            <BrandMark />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 items-center divide-x divide-line rounded-lg border border-line bg-surface/70 px-0.5">
              <ResourcePill icon="gold" label="Or" value={profile.gold} colorClassName="text-amber-200" />
              <ResourcePill icon="crystal" label="Cristaux" value={profile.crystals ?? 0} colorClassName="text-sky-200" />
              <ResourcePill
                icon="wood"
                label="Bois"
                value={profile.resources.wood ?? 0}
                colorClassName="text-emerald-200"
                hiddenOnMobile
              />
              <ResourcePill
                icon="ore"
                label="Minerai"
                value={profile.resources.ore ?? 0}
                colorClassName="text-fg-muted"
                hiddenOnMobile
              />
              <ResourcePill
                icon="essence"
                label="Essence"
                value={profile.resources.essence ?? 0}
                colorClassName="text-purple-200"
                hiddenOnMobile
              />
            </div>
            <button
              onClick={logout}
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className={buttonClasses("ghost", "sm", "hidden w-8 px-0 lg:inline-flex")}
            >
              <NavIcon name="logout" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-10 px-4 lg:px-6">
        <nav
          aria-label="Navigation principale"
          className="panel-scrollbar sticky top-14 hidden max-h-[calc(100dvh-3.5rem)] w-52 shrink-0 self-start overflow-y-auto py-8 pl-3 lg:block"
        >
          <SidebarNav pathname={pathname} />
        </nav>
        <main className={`min-w-0 flex-1 pt-6 lg:pt-10 ${immersive ? "pb-6" : "pb-tabbar"}`}>{children}</main>
      </div>

      {!immersive && (
        <>
          <TabBar pathname={pathname} menuOpen={menuOpen} onMenu={() => setMenuOpen(true)} />
          <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} pathname={pathname} onLogout={logout} />
        </>
      )}
    </div>
  );
}
