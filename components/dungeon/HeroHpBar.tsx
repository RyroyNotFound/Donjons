"use client";

import { ProgressBar } from "@/components/ProgressBar";
import { ROLE_GRADIENT, ROLE_GLOW } from "@/lib/ui/role";
import type { RaidHeroState } from "@/types/game";

export function HeroHpBar({ hero }: { hero: RaidHeroState }) {
  const dead = hero.hp <= 0;
  return (
    <div className={dead ? "opacity-40" : ""}>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className={dead ? "text-slate-500 line-through" : "text-slate-200"}>
          {hero.name}
          {!dead && (hero.weakened ?? 0) > 0 && (
            <span className="ml-1 text-amber-400" title="Affaibli par les pièges : moins de dégâts infligés, plus de dégâts subis au prochain combat">
              💫×{hero.weakened}
            </span>
          )}
        </span>
        <span>
          {hero.hp}/{hero.maxHp}
        </span>
      </div>
      <ProgressBar
        value={hero.hp}
        max={hero.maxHp}
        colorClassName={ROLE_GRADIENT[hero.role]}
        glowClassName={ROLE_GLOW[hero.role]}
        label={`Points de vie de ${hero.name}`}
      />
    </div>
  );
}
