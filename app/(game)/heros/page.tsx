"use client";

import Link from "next/link";
import { useGameData } from "@/lib/game/GameDataProvider";
import { getSubclass } from "@/lib/game/content/classes";
import { resolveHeroStats } from "@/lib/game/engine/stats";
import { xpToNextLevel } from "@/lib/game/engine/xp";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";

const STATUS_LABEL: Record<string, string> = {
  idle: "Disponible",
  expedition: "En expédition",
  "dungeon-guard": "En garde",
};

const ROLE_COLOR: Record<string, string> = {
  DPS: "text-red-400",
  HEAL: "text-emerald-400",
  TANK: "text-sky-400",
};

export default function HerosPage() {
  const { heroes, items } = useGameData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-50">Vos héros</h1>
        <Link
          href="/gacha"
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
        >
          + Invocation
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {heroes.map((hero) => {
          const subclass = getSubclass(hero.subclassId);
          const equippedItems = Object.values(hero.equipment)
            .filter(Boolean)
            .map((id) => items.find((i) => i.id === id))
            .filter(Boolean) as typeof items;
          const stats = resolveHeroStats(hero, equippedItems);

          return (
            <Link key={hero.id} href={`/heros/${hero.id}`}>
              <Card className="h-full transition hover:border-amber-500">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-zinc-50">{hero.name}</h2>
                  <span className="text-xs text-zinc-500">{STATUS_LABEL[hero.status]}</span>
                </div>
                <p className={`text-sm ${ROLE_COLOR[hero.role]}`}>
                  {subclass.name} · {hero.role}
                </p>
                <p className="mt-1 text-sm text-amber-400">
                  {"★".repeat(hero.starRank ?? 1)}
                  {"☆".repeat(5 - (hero.starRank ?? 1))}
                </p>
                <p className="text-sm text-zinc-400">Niveau {hero.level}</p>
                <div className="mt-2">
                  <ProgressBar value={hero.xp} max={xpToNextLevel(hero.level)} />
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1 text-center text-xs text-zinc-400">
                  <span>PV {stats.hp}</span>
                  <span>ATK {stats.atk}</span>
                  <span>DEF {stats.def}</span>
                  <span>VIT {stats.spd}</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
