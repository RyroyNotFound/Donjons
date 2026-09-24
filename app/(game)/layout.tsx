"use client";

import { useEffect } from "react";
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
import { focusRing } from "@/lib/ui/a11y";
import type { IconName } from "@/lib/ui/icons";

const NAV_LINKS: { href: string; label: string; icon: string; iconName?: IconName }[] = [
  { href: "/tableau-de-bord", label: "Tableau de bord", icon: "🏰" },
  { href: "/heros", label: "Héros", icon: "🧙" },
  { href: "/heros/inventaire", label: "Inventaire", icon: "🎒" },
  { href: "/gacha", label: "Invocation", icon: "🔮" },
  { href: "/donjon", label: "Mon donjon", icon: "🛡️", iconName: "shield" },
  { href: "/donjon/ameliorations", label: "Améliorations", icon: "🛠️" },
  { href: "/donjon/attaquer", label: "Attaquer", icon: "⚔️", iconName: "sword" },
  { href: "/expeditions", label: "Expéditions", icon: "🗺️", iconName: "scroll" },
  { href: "/forge", label: "Forge", icon: "🔨" },
];

export default function GameLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { profile } = useGameData();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/connexion");
  }, [loading, user, router]);

  if (loading || !user) {
    return <Spinner label="Chargement..." />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <header
        className="sticky top-0 z-20 border-b border-white/10 bg-[var(--ink-950)]/85 backdrop-blur-md"
        style={{ viewTransitionName: "site-header" } as React.CSSProperties}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/tableau-de-bord" className="font-display text-gold-gradient text-lg font-bold tracking-wide">
            ⚔️ Donjons
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            {profile && (
              <div className="flex flex-wrap items-center gap-1.5">
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
            <button onClick={() => signOut(auth)} className={buttonClasses("ghost", "sm", "border border-white/10")}>
              Déconnexion
            </button>
          </div>
        </div>
        <nav className="panel-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2.5">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${focusRing} ${
                  active ? PRIMARY_GRADIENT : "text-slate-300 hover:bg-white/5"
                }`}
              >
                {link.iconName ? (
                  <Icon name={link.iconName} className="h-4 w-4" />
                ) : (
                  <span aria-hidden>{link.icon}</span>
                )}
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
