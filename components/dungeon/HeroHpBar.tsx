"use client";

import { ProgressBar } from "@/components/ProgressBar";
import { ROLE_GRADIENT } from "@/lib/ui/role";
import type { RaidHeroState } from "@/types/game";

export function HeroHpBar({ hero }: { hero: RaidHeroState }) {
  const dead = hero.hp <= 0;
  return (
    <div className={`transition-opacity duration-200 ease-out ${dead ? "opacity-40" : ""}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className={`truncate font-medium ${dead ? "text-fg-subtle line-through" : "text-fg"}`}>
          {hero.name}
          {!dead && (hero.weakened ?? 0) > 0 && (
            <span
              className="ml-1.5 font-normal tabular-nums text-amber-300"
              title="Affaibli par les pièges : moins de dégâts infligés, plus de dégâts subis au prochain combat"
            >
              💫×{hero.weakened}
            </span>
          )}
        </span>
        <span className="shrink-0 tabular-nums text-fg-muted">
          {hero.hp}
          <span className="text-fg-faint">/{hero.maxHp}</span>
        </span>
      </div>
      <ProgressBar
        value={hero.hp}
        max={hero.maxHp}
        colorClassName={ROLE_GRADIENT[hero.role]}
        label={`Points de vie de ${hero.name}`}
      />
    </div>
  );
}
