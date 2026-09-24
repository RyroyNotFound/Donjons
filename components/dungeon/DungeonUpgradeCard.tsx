"use client";

import { dungeonUpgradeCost } from "@/lib/game/dungeonEconomy";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import type { DungeonUpgradeTrack } from "@/lib/game/content/dungeonUpgrades";
import type { ResourceKind, UserProfile } from "@/types/game";

const RESOURCE_LABEL: Record<ResourceKind, string> = {
  wood: "Bois",
  ore: "Minerai",
  essence: "Essence",
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
  const cost = maxed ? {} : dungeonUpgradeCost(track.id, level);
  const canAfford =
    !maxed &&
    profile !== null &&
    Object.entries(cost).every(
      ([kind, amount]) => (profile.resources[kind as ResourceKind] ?? 0) >= (amount ?? 0),
    );

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
        <p className="mt-1 text-xs text-slate-500">
          Prochain niveau : {track.effectLabel(level + 1)}
          <br />
          Coût :{" "}
          {Object.entries(cost)
            .map(([kind, amount]) => `${amount} ${RESOURCE_LABEL[kind as ResourceKind]}`)
            .join(", ")}
        </p>
      )}
      <Button onClick={onUpgrade} disabled={maxed || upgrading || !canAfford} className="mt-3 w-full">
        {maxed ? "Niveau maximum" : upgrading ? "Amélioration..." : "Améliorer"}
      </Button>
    </Card>
  );
}
