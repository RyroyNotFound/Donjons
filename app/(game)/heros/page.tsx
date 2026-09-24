"use client";

import Link from "next/link";
import { ViewTransition } from "react";
import { useState } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { tryGetClass } from "@/lib/game/content/classes";
import { resolveHeroStats } from "@/lib/game/engine/stats";
import { xpToNextLevel } from "@/lib/game/engine/xp";
import { heroSlotsForLevel } from "@/lib/game/content/dungeonUpgrades";
import { heroSlotCost, MAX_HEROES } from "@/lib/game/economy";
import { callApi } from "@/lib/api/client";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { PageHeader } from "@/components/PageHeader";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button, buttonClasses } from "@/components/Button";
import { ROLE_TEXT_COLOR } from "@/lib/ui/role";
import { PageTransition } from "@/components/PageTransition";
import { SpriteAnimation } from "@/components/SpriteAnimation";
import { HERO_SPRITE_BY_ROLE, CLASS_TINT } from "@/lib/ui/heroSprites";

const STATUS_LABEL: Record<string, string> = {
  idle: "Disponible",
  expedition: "En expédition",
  "dungeon-guard": "En garde",
  "dungeon-raid": "En raid",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  idle: "success",
  expedition: "info",
  "dungeon-guard": "gold",
  "dungeon-raid": "gold",
};

export default function HerosPage() {
  const { heroes, items, dungeonUpgrades, profile } = useGameData();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const heroSlotsLevel = dungeonUpgrades?.levels.heroSlots ?? 0;
  const slots = Math.min(MAX_HEROES, heroSlotsForLevel(heroSlotsLevel));
  const freeSlot = heroes.length < slots;
  const atMax = slots >= MAX_HEROES;
  const slotCost = heroSlotCost(heroSlotsLevel);
  const canRecruit = freeSlot || (!atMax && (profile?.gold ?? 0) >= slotCost);

  async function recruit() {
    setError(null);
    setBusy(true);
    try {
      await callApi("/api/heroes/recruit", {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageTransition>
    <div className="space-y-6">
      <PageHeader
        title="Vos héros"
        subtitle="Gérez votre garnison, leur classe, leurs sorts/talents/maîtrises et leur équipement."
        action={
          <Link href="/gacha" transitionTypes={["nav-forward"]} className={buttonClasses("primary", "md")}>
            + Invocation
          </Link>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            Emplacements de héros : <span className="text-slate-100">{heroes.length}/{slots}</span>
            {!freeSlot && !atMax && (
              <> — un nouvel emplacement coûte <span className="text-amber-300">{slotCost} or</span>.</>
            )}
            {atMax && !freeSlot && <> — maximum atteint.</>}
          </p>
          <Button size="sm" onClick={recruit} disabled={busy || !canRecruit}>
            {freeSlot || atMax ? "Recruter un héros" : `Recruter (${slotCost} or)`}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {heroes.map((hero, i) => {
          const classDef = tryGetClass(hero.classId);
          const equippedItems = Object.values(hero.equipment)
            .filter(Boolean)
            .map((id) => items.find((i) => i.id === id))
            .filter(Boolean) as typeof items;
          const stats = resolveHeroStats(hero, equippedItems, profile?.componentRanks);

          return (
            <div
              key={hero.id}
              className="animate-rise"
              style={{ "--delay": `${Math.min(i, 8) * 0.06}s` } as React.CSSProperties}
            >
              <Link href={`/heros/${hero.id}`} transitionTypes={["nav-forward"]}>
                <Card interactive className="h-full">
                  <div className="flex items-center justify-between">
                    <ViewTransition name={`hero-title-${hero.id}`}>
                      <div className="flex items-center gap-2">
                        {classDef && (
                          <SpriteAnimation
                            sheet={HERO_SPRITE_BY_ROLE[classDef.role]}
                            frames={4}
                            frameSize={32}
                            tint={CLASS_TINT[classDef.id]}
                            className="h-8 w-8"
                          />
                        )}
                        <h2 className="font-display font-semibold text-slate-50">{hero.name}</h2>
                      </div>
                    </ViewTransition>
                    <Badge tone={STATUS_TONE[hero.status]}>{STATUS_LABEL[hero.status]}</Badge>
                  </div>
                  <p
                    className={`mt-1 text-sm font-medium ${classDef ? ROLE_TEXT_COLOR[classDef.role] : "text-slate-500"}`}
                  >
                    {classDef ? `${classDef.name} · ${classDef.role}` : "Sans classe — à personnaliser"}
                  </p>
                  <p className="mt-1 text-sm text-amber-400">
                    {"★".repeat(hero.starRank ?? 1)}
                    {"☆".repeat(5 - (hero.starRank ?? 1))}
                  </p>
                  <p className="text-sm text-slate-400">Niveau {hero.level}</p>
                  <div className="mt-2">
                    <ProgressBar value={hero.xp} max={xpToNextLevel(hero.level)} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-white/5 bg-black/20 py-2 text-center text-xs text-slate-400">
                    <span>PV {stats.hp}</span>
                    <span>ATQp {stats.atkPhys}</span>
                    <span>ATQm {stats.atkMag}</span>
                    <span>VIT {stats.spd}</span>
                    <span>DEFp {stats.defPhys}</span>
                    <span>DEFm {stats.defMag}</span>
                  </div>
                </Card>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
    </PageTransition>
  );
}
