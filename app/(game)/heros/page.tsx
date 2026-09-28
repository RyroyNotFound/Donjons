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
import { ROLE_TEXT_COLOR, ROLE_LABEL } from "@/lib/ui/role";
import { RARITY_LABEL } from "@/lib/ui/rarity";
import { ITEM_SLOT_LABEL } from "@/lib/game/statFormat";
import { PageTransition } from "@/components/PageTransition";
import { SpriteAnimation } from "@/components/SpriteAnimation";
import { HERO_SPRITE_BY_ROLE, CLASS_TINT } from "@/lib/ui/heroSprites";
import { focusRing } from "@/lib/ui/a11y";

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
      <div className="space-y-8">
        <PageHeader
          title="Vos héros"
          subtitle="Gérez votre garnison, leur classe, leurs sorts/talents/maîtrises et leur équipement."
          action={
            <Link href="/gacha" transitionTypes={["nav-forward"]} className={buttonClasses("primary", "md")}>
              + Invocation
            </Link>
          }
        />

        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg-muted">
              Emplacements de héros :{" "}
              <span className="font-semibold tabular-nums text-fg">
                {heroes.length}/{slots}
              </span>
              {!freeSlot && !atMax && (
                <>
                  {" "}
                  — un nouvel emplacement coûte <span className="tabular-nums text-amber-300">{slotCost} or</span>.
                </>
              )}
              {atMax && !freeSlot && <> — maximum atteint.</>}
            </p>
            <Button size="sm" onClick={recruit} disabled={busy || !canRecruit}>
              {freeSlot || atMax ? "Recruter un héros" : `Recruter (${slotCost} or)`}
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {heroes.map((hero, i) => {
            const classDef = tryGetClass(hero.classId);
            const equippedItems = Object.values(hero.equipment)
              .filter(Boolean)
              .map((id) => items.find((i) => i.id === id))
              .filter(Boolean) as typeof items;
            const stats = resolveHeroStats(hero, equippedItems, profile?.componentRanks);
            const star = hero.starRank ?? 1;
            const statCells: [string, number][] = [
              ["PV", stats.hp],
              ["ATQp", stats.atkPhys],
              ["ATQm", stats.atkMag],
              ["VIT", stats.spd],
              ["DEFp", stats.defPhys],
              ["DEFm", stats.defMag],
            ];

            return (
              <Link
                key={hero.id}
                href={`/heros/${hero.id}`}
                transitionTypes={["nav-forward"]}
                className={`animate-rise group flex h-full flex-col rounded-xl border border-line bg-surface p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.04),0_1px_2px_rgb(0_0_0/0.3)] transition-[transform,border-color,background-color] duration-150 ease-out hover:border-line-strong hover:bg-surface-2 active:scale-[0.99] ${focusRing}`}
                style={{ "--delay": `${Math.min(i, 6) * 40}ms` } as React.CSSProperties}
              >
                <div className="flex items-start justify-between gap-3">
                  <ViewTransition name={`hero-title-${hero.id}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-white/[0.03]">
                        {classDef && (
                          <SpriteAnimation
                            sheet={HERO_SPRITE_BY_ROLE[classDef.role]}
                            frames={4}
                            frameSize={32}
                            tint={CLASS_TINT[classDef.id]}
                            className="h-8 w-8"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold text-fg">{hero.name}</h2>
                        <p
                          className={`truncate text-xs font-medium ${classDef ? ROLE_TEXT_COLOR[classDef.role] : "text-fg-subtle"}`}
                        >
                          {classDef ? `${classDef.name} · ${ROLE_LABEL[classDef.role]}` : "Sans classe — à personnaliser"}
                        </p>
                      </div>
                    </div>
                  </ViewTransition>
                  <Badge tone={STATUS_TONE[hero.status]} className="shrink-0">
                    {STATUS_LABEL[hero.status]}
                  </Badge>
                </div>

                <div className="mt-4 flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-fg-muted">
                    Niveau <span className="font-semibold tabular-nums text-fg">{hero.level}</span>
                  </span>
                  <span className="tracking-wider">
                    <span className="text-gold">{"★".repeat(star)}</span>
                    <span className="text-fg-faint">{"☆".repeat(5 - star)}</span>
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={hero.xp} max={xpToNextLevel(hero.level)} size="sm" label="Expérience" />
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
                  {statCells.map(([label, value]) => (
                    <div
                      key={label}
                      className="bg-surface px-2 py-1.5 transition-colors duration-150 ease-out group-hover:bg-surface-2"
                    >
                      <dt className="text-[11px] text-fg-subtle">{label}</dt>
                      <dd className="text-sm font-semibold tabular-nums text-fg">{value}</dd>
                    </div>
                  ))}
                </dl>

                {equippedItems.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-1">
                    {equippedItems.map((item) => (
                      <li key={item.id} title={`${ITEM_SLOT_LABEL[item.slot]} · ${RARITY_LABEL[item.rarity]}`}>
                        <Badge tone={item.rarity}>
                          {item.name}
                          {item.enhanceLevel ? ` +${item.enhanceLevel}` : ""}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-fg-faint">Aucun équipement</p>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </PageTransition>
  );
}
