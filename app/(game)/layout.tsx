"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useGameData } from "@/lib/game/GameDataProvider";

const NAV_LINKS = [
  { href: "/tableau-de-bord", label: "Tableau de bord" },
  { href: "/heros", label: "Héros" },
  { href: "/gacha", label: "Invocation" },
  { href: "/donjon", label: "Mon donjon" },
  { href: "/donjon/attaquer", label: "Attaquer" },
  { href: "/expeditions", label: "Expéditions" },
  { href: "/forge", label: "Forge" },
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
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-zinc-400">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <nav className="flex flex-wrap gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  pathname === link.href
                    ? "bg-amber-500 text-zinc-950"
                    : "text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-sm text-zinc-300">
            {profile && (
              <div className="flex items-center gap-3">
                <span title="Or">🪙 {profile.gold}</span>
                <span title="Cristaux">💎 {profile.crystals ?? 0}</span>
                <span title="Bois">🪵 {profile.resources.wood ?? 0}</span>
                <span title="Minerai">⛏️ {profile.resources.ore ?? 0}</span>
                <span title="Essence">✨ {profile.resources.essence ?? 0}</span>
              </div>
            )}
            <button
              onClick={() => signOut(auth)}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
