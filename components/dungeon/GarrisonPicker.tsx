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
              {hero.name} (Nv.{hero.level})
            </Chip>
          );
        })}
      </div>
      {eligible.length === 0 && <p className="text-sm text-slate-500">Aucun héros disponible.</p>}
      <p className="mt-2 text-xs text-slate-500">
        {selectedIds.length}/{capacity} emplacement(s) de garnison
      </p>
    </div>
  );
}
