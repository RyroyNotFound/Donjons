"use client";

import { BOSSES, MONSTERS, TRAPS, TRAP_STACK_FALLOFF, trapTierUnlockedAtLevel } from "@/lib/game/content/dungeon";
import { ELEMENT_ICON, ELEMENT_LABEL } from "@/lib/game/engine/elements";
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

  // Monsters can be stacked (several of the same kind); traps can't (one of each per room).
  function addMonster(monsterId: string) {
    const current = room.monsterRefIds ?? [];
    if (current.length >= maxOccupants) return;
    onChange({ ...room, monsterRefIds: [...current, monsterId] });
  }

  function removeMonster(monsterId: string) {
    const current = [...(room.monsterRefIds ?? [])];
    const index = current.lastIndexOf(monsterId);
    if (index < 0) return;
    current.splice(index, 1);
    onChange({ ...room, monsterRefIds: current });
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
                {t.element ? `${ELEMENT_ICON[t.element]} ` : ""}
                {t.name} · {Math.round(t.damagePercent * 100)} % PV · {t.cost} pts · {t.baseCharges} charge(s)
                {!unlocked && " (verrouillé)"}
              </Chip>
            );
          })}
          <p className="text-xs text-slate-500">
            {maxOccupants} piège(s) différent(s) max par salle. Chaque piège supplémentaire dans la même salle frappe {Math.round((1 - TRAP_STACK_FALLOFF) * 100)} % moins fort
            que le précédent. Les dégâts sont réduits par la résistance aux pièges des attaquants (et par leur résistance à l&apos;élément du piège) :
            varier les éléments complique leur préparation.
          </p>
        </div>
      )}

      {room.type === "monster" && (
        <div className="space-y-1.5">
          {[...ownedMonsters, ...BOSSES].map((m) => {
            const count = (room.monsterRefIds ?? []).filter((id) => id === m.id).length;
            const full = (room.monsterRefIds ?? []).length >= maxOccupants;
            return (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300">
                <span>
                  {m.element ? `${ELEMENT_ICON[m.element]} ` : ""}
                  {m.name} · {m.cost} pts{m.isBoss ? " · Boss" : ` · ${capturedMonsters[m.id] ?? 0} capturé(s)`}
                  {m.element && <span className="text-xs text-slate-500"> (attaque {ELEMENT_LABEL[m.element].toLowerCase()})</span>}
                </span>
                <span className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => removeMonster(m.id)} disabled={count === 0}>
                    −
                  </Button>
                  <span className={`w-5 text-center ${count > 0 ? "text-amber-300" : "text-slate-500"}`}>{count}</span>
                  <Button size="sm" variant="ghost" onClick={() => addMonster(m.id)} disabled={full}>
                    +
                  </Button>
                </span>
              </div>
            );
          })}
          {ownedMonsters.length === 0 && (
            <p className="text-xs text-slate-500">Aucun monstre capturé pour l&apos;instant.</p>
          )}
          <p className="text-xs text-slate-500">
            {maxOccupants} monstre(s) max par salle. Leurs stats suivent le niveau de défense de votre donjon (le niveau moyen de vos 4 meilleurs héros).
          </p>
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
