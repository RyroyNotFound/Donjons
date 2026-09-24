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
  wood: "text-emerald-300",
  ore: "text-slate-300",
  essence: "text-purple-300",
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
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="font-display font-semibold text-slate-50">{track.name}</p>
        <Badge tone={maxed ? "success" : "gold"}>
          Nv. {level}/{track.maxLevel}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-slate-400">{track.description}</p>
      <p className="mt-2 text-sm text-amber-300">Effet actuel : {track.effectLabel(level)}</p>
      {!maxed && (
        <>
          <p className="mt-1 text-xs text-slate-500">Prochain niveau : {track.effectLabel(level + 1)}</p>
          <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Coût du niveau {level + 1}
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {cost.map(([kind, amount]) => {
                const enough = owned(kind) >= amount;
                return (
                  <li
                    key={kind}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-semibold ${
                      enough ? `border-white/10 bg-white/5 ${RESOURCE_COLOR[kind]}` : "border-red-500/40 bg-red-500/10 text-red-300"
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
        </>
      )}
      <Button onClick={onUpgrade} disabled={maxed || upgrading || !canAfford} className="mt-3 w-full">
        {maxed ? "Niveau maximum" : upgrading ? "Amélioration..." : canAfford ? "Améliorer" : "Ressources insuffisantes"}
      </Button>
    </Card>
  );
}
