"use client";

import { useState } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { DUNGEON_UPGRADE_TRACKS } from "@/lib/game/content/dungeonUpgrades";
import { PageHeader } from "@/components/PageHeader";
import { DungeonUpgradeCard } from "@/components/dungeon/DungeonUpgradeCard";
import { PageTransition } from "@/components/PageTransition";
import type { DungeonUpgradeTrackId } from "@/types/game";

export default function DungeonUpgradesPage() {
  const { profile, dungeonUpgrades } = useGameData();
  const [upgrading, setUpgrading] = useState<DungeonUpgradeTrackId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const levels = dungeonUpgrades?.levels;

  async function upgrade(trackId: DungeonUpgradeTrackId) {
    setError(null);
    setUpgrading(trackId);
    try {
      await callApi("/api/dungeon/upgrade", { trackId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUpgrading(null);
    }
  }

  return (
    <PageTransition>
      <div className="space-y-8">
        <PageHeader
          title="Améliorations du donjon"
          subtitle="Dépensez les ressources récoltées en expédition pour renforcer votre donjon."
        />

        {error && (
          <p role="alert" className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DUNGEON_UPGRADE_TRACKS.map((track, i) => (
            <div
              key={track.id}
              className="animate-rise grid"
              style={{ "--delay": `${Math.min(i, 6) * 40}ms` } as React.CSSProperties}
            >
              <DungeonUpgradeCard
                track={track}
                level={levels?.[track.id] ?? 0}
                profile={profile}
                upgrading={upgrading === track.id}
                onUpgrade={() => upgrade(track.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
