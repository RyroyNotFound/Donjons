"use client";

import { BOSSES, MONSTERS, TRAPS, trapTierUnlockedAtLevel } from "@/lib/game/content/dungeon";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { selectClass } from "@/components/Field";
import type { DungeonRoomCell, DungeonRoomContentType } from "@/types/game";

export function RoomInspector({
  room,
  maxOccupants,
  trapcraftLevel,
  capturedMonsters,
  canRemove,
  onChange,
  onRemove,
}: {
  room: DungeonRoomCell;
  maxOccupants: number;
  trapcraftLevel: number;
  capturedMonsters: Record<string, number>;
  canRemove: boolean;
  onChange: (next: DungeonRoomCell) => void;
  onRemove: () => void;
}) {
  function setType(type: DungeonRoomContentType) {
    onChange({ row: room.row, col: room.col, type });
  }

  function toggleTrap(trapId: string) {
    const current = room.trapIds ?? [];
    const next = current.includes(trapId)
      ? current.filter((id) => id !== trapId)
      : current.length < maxOccupants
        ? [...current, trapId]
        : current;
    onChange({ ...room, trapIds: next });
  }

  function toggleMonster(monsterId: string) {
    const current = room.monsterRefIds ?? [];
    const next = current.includes(monsterId)
      ? current.filter((id) => id !== monsterId)
      : current.length < maxOccupants
        ? [...current, monsterId]
        : current;
    onChange({ ...room, monsterRefIds: next });
  }

  const ownedMonsters = MONSTERS.filter((m) => (capturedMonsters[m.id] ?? 0) > 0);

  return (
    <div className="space-y-3">
      <select
        value={room.type}
        onChange={(e) => setType(e.target.value as DungeonRoomContentType)}
        className={selectClass}
      >
        <option value="empty">Vide</option>
        <option value="trap">Piège</option>
        <option value="monster">Monstre</option>
        <option value="treasure">Salle au trésor</option>
      </select>

      {room.type === "trap" && (
        <div className="space-y-1.5">
          {TRAPS.map((t) => {
            const unlocked = trapcraftLevel >= trapTierUnlockedAtLevel(t.tier);
            const selected = (room.trapIds ?? []).includes(t.id);
            return (
              <Chip key={t.id} selected={selected} disabled={!unlocked} onClick={() => toggleTrap(t.id)} fullWidth>
                {t.name} · {t.cost} pts · {t.baseCharges} charge(s)
                {!unlocked && " (verrouillé)"}
              </Chip>
            );
          })}
          <p className="text-xs text-slate-500">{maxOccupants} piège(s) max par salle.</p>
        </div>
      )}

      {room.type === "monster" && (
        <div className="space-y-1.5">
          {[...ownedMonsters, ...BOSSES].map((m) => {
            const selected = (room.monsterRefIds ?? []).includes(m.id);
            return (
              <Chip key={m.id} selected={selected} onClick={() => toggleMonster(m.id)} fullWidth>
                {m.name} · {m.cost} pts{m.isBoss ? " · Boss" : ` · x${capturedMonsters[m.id] ?? 0}`}
              </Chip>
            );
          })}
          {ownedMonsters.length === 0 && (
            <p className="text-xs text-slate-500">Aucun monstre capturé pour l&apos;instant.</p>
          )}
          <p className="text-xs text-slate-500">{maxOccupants} monstre(s) max par salle.</p>
        </div>
      )}

      <Button variant="danger" size="sm" onClick={onRemove} disabled={!canRemove}>
        Retirer la salle
      </Button>
      {!canRemove && (
        <p className="text-xs text-slate-500">Retirer cette salle déconnecterait le donjon.</p>
      )}
    </div>
  );
}
