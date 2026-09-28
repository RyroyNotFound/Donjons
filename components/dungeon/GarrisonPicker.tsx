"use client";

import { Chip } from "@/components/Chip";
import type { Hero } from "@/types/game";

export function GarrisonPicker({
  heroes,
  selectedIds,
  capacity,
  onToggle,
}: {
  heroes: Hero[];
  selectedIds: string[];
  capacity: number;
  onToggle: (heroId: string) => void;
}) {
  const eligible = heroes.filter((h) => h.classId && (h.status === "idle" || h.status === "dungeon-guard"));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {eligible.map((hero) => {
          const selected = selectedIds.includes(hero.id);
          const disabled = !selected && selectedIds.length >= capacity;
          return (
            <Chip key={hero.id} selected={selected} disabled={disabled} onClick={() => onToggle(hero.id)}>
              {hero.name} <span className="tabular-nums opacity-70">(Nv.{hero.level})</span>
            </Chip>
          );
        })}
      </div>
      {eligible.length === 0 && <p className="text-sm text-fg-subtle">Aucun héros disponible.</p>}
      <p className="mt-3 text-xs tabular-nums text-fg-subtle">
        {selectedIds.length}/{capacity} emplacement(s) de garnison
      </p>
    </div>
  );
}
