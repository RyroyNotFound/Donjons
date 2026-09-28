"use client";

import { dungeonUpgradeCost } from "@/lib/game/dungeonEconomy";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Icon } from "@/components/Icon";
import type { DungeonUpgradeTrack } from "@/lib/game/content/dungeonUpgrades";
import type { ResourceKind, UserProfile } from "@/types/game";

const RESOURCE_LABEL: Record<ResourceKind, string> = {
  wood: "Bois",
  ore: "Minerai",
  essence: "Essence",
};

// Same colours as the header's resource pills (app/(game)/layout.tsx).
const RESOURCE_COLOR: Record<ResourceKind, string> = {
  wood: "text-emerald-200",
  ore: "text-fg-muted",
  essence: "text-purple-200",
};

export function DungeonUpgradeCard({
  track,
  level,
  profile,
  upgrading,
  onUpgrade,
}: {
  track: DungeonUpgradeTrack;
  level: number;
  profile: UserProfile | null;
  upgrading: boolean;
  onUpgrade: () => void;
}) {
  const maxed = level >= track.maxLevel;
  const cost = (maxed ? [] : Object.entries(dungeonUpgradeCost(track.id, level))) as [ResourceKind, number][];
  const owned = (kind: ResourceKind) => profile?.resources[kind] ?? 0;
  const canAfford = !maxed && profile !== null && cost.every(([kind, amount]) => owned(kind) >= amount);

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-fg">{track.name}</h2>
        <Badge tone={maxed ? "success" : "neutral"} className="tabular-nums">
          Nv. {level}/{track.maxLevel}
        </Badge>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-fg-muted">{track.description}</p>

      <dl className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-white/[0.025] text-sm">
        <div className="px-3 py-2">
          <dt className="text-xs text-fg-subtle">Effet actuel</dt>
          <dd className="mt-0.5 tabular-nums text-fg">{track.effectLabel(level)}</dd>
        </div>
        {!maxed && (
          <div className="px-3 py-2">
            <dt className="text-xs text-fg-subtle">Prochain niveau</dt>
            <dd className="mt-0.5 tabular-nums text-gold">{track.effectLabel(level + 1)}</dd>
          </div>
        )}
      </dl>

      {!maxed && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Coût du niveau <span className="tabular-nums">{level + 1}</span>
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {cost.map(([kind, amount]) => {
              const enough = owned(kind) >= amount;
              return (
                <li
                  key={kind}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-semibold tabular-nums ${
                    enough ? `border-line bg-white/[0.04] ${RESOURCE_COLOR[kind]}` : "border-red-400/25 bg-red-400/10 text-red-300"
                  }`}
                  aria-label={`${RESOURCE_LABEL[kind]} : ${amount} requis, ${owned(kind)} possédé`}
                >
                  <Icon name={kind} className="h-4 w-4" />
                  {amount}
                  <span className="text-xs font-normal opacity-70">
                    {RESOURCE_LABEL[kind]} · {owned(kind)}/{amount}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-5">
        <Button
          variant={maxed || !canAfford ? "secondary" : "primary"}
          onClick={onUpgrade}
          disabled={maxed || upgrading || !canAfford}
          className="w-full"
        >
          {maxed ? "Niveau maximum" : upgrading ? "Amélioration..." : canAfford ? "Améliorer" : "Ressources insuffisantes"}
        </Button>
      </div>
    </Card>
  );
}
