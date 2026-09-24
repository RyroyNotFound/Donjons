"use client";

import { useState } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { BOSSES, ENTRANCE_CELL, MONSTERS, TRAPS, TREASURE_ROOM_COST, monsterScaleForDefenseLevel } from "@/lib/game/content/dungeon";
import {
  DEFAULT_UPGRADE_LEVELS,
  garrisonCapacityForLevel,
  maxOccupantsForLevel,
  maxRoomsForLevel,
  dungeonDefenseLevel,
  dungeonPointBudget,
} from "@/lib/game/content/dungeonUpgrades";
import { findDisconnectedRooms, isAdjacent, roomKey } from "@/lib/game/engine/dungeonLayout";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Panel } from "@/components/Panel";
import { PageTransition } from "@/components/PageTransition";
import { SpriteAnimation } from "@/components/SpriteAnimation";
import { MONSTER_SPRITE } from "@/lib/ui/monsterSprites";
import { DungeonGridEditor } from "@/components/dungeon/DungeonGridEditor";
import { RoomInspector } from "@/components/dungeon/RoomInspector";
import { GarrisonPicker } from "@/components/dungeon/GarrisonPicker";
import type { Dungeon, DungeonRoomCell, DungeonUpgrades } from "@/types/game";

function entranceRoom(): DungeonRoomCell[] {
  return [{ ...ENTRANCE_CELL, type: "empty" }];
}

function pointsSpentOf(rooms: DungeonRoomCell[]): number {
  let total = 0;
  for (const room of rooms) {
    if (room.type === "trap") {
      total += (room.trapIds ?? []).reduce(
        (sum, id) => sum + (TRAPS.find((t) => t.id === id)?.cost ?? 0),
        0,
      );
    } else if (room.type === "monster") {
      total += (room.monsterRefIds ?? []).reduce((sum, id) => {
        const monster = MONSTERS.find((m) => m.id === id) ?? BOSSES.find((m) => m.id === id);
        return sum + (monster?.cost ?? 0);
      }, 0);
    } else if (room.type === "treasure") {
      total += TREASURE_ROOM_COST;
    }
  }
  return total;
}

export default function DonjonPage() {
  const { dungeon, profile, heroes, dungeonUpgrades } = useGameData();
  const [rooms, setRooms] = useState<DungeonRoomCell[]>(entranceRoom());
  const [garrisonHeroIds, setGarrisonHeroIds] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadedFrom, setLoadedFrom] = useState<Dungeon | null>(null);

  // Seed the editable form from the loaded dungeon exactly once, the first
  // time it arrives from Firestore — a render-time state adjustment rather
  // than an effect, per https://react.dev/learn/you-might-not-need-an-effect.
  if (dungeon && dungeon !== loadedFrom) {
    setLoadedFrom(dungeon);
    setRooms(dungeon.rooms);
    setGarrisonHeroIds(dungeon.garrisonHeroIds);
  }

  const levels = dungeonUpgrades?.levels ?? DEFAULT_UPGRADE_LEVELS;
  const maxRooms = maxRoomsForLevel(levels.expansion);
  const defenseLevel = dungeonDefenseLevel(heroes.filter((h) => h.classId).map((h) => h.level));
  const budget = dungeonPointBudget(levels.architecture, defenseLevel);
  const defenseLog = profile?.defenseLog ?? [];
  const maxOccupants = maxOccupantsForLevel(levels.hazardDensity);
  const garrisonCapacity = garrisonCapacityForLevel(levels.defenderVigor);

  const roomCount = rooms.length - 1;
  const pointsSpent = pointsSpentOf(rooms);
  const treasureRoomCount = rooms.filter((r) => r.type === "treasure").length;
  const overBudget = pointsSpent > budget;
  const overRoomCap = roomCount > maxRooms;
  const treasureCountValid = treasureRoomCount >= 1 && treasureRoomCount <= 4;
  const capturedMonsters = profile?.capturedMonsters ?? {};
  const selectedRoom = rooms.find((r) => roomKey(r) === selectedKey) ?? null;
  const isEntranceSelected =
    selectedRoom && selectedRoom.row === ENTRANCE_CELL.row && selectedRoom.col === ENTRANCE_CELL.col;

  function updateRoom(next: DungeonRoomCell) {
    setSaved(false);
    setRooms((prev) => prev.map((r) => (roomKey(r) === roomKey(next) ? next : r)));
  }

  function canRemoveRoom(cell: DungeonRoomCell): boolean {
    const remaining = rooms.filter((r) => roomKey(r) !== roomKey(cell));
    return findDisconnectedRooms(remaining).length === 0;
  }

  function removeSelectedRoom() {
    if (!selectedRoom) return;
    setSaved(false);
    setRooms((prev) => prev.filter((r) => roomKey(r) !== roomKey(selectedRoom)));
    setSelectedKey(null);
  }

  function handleCellClick(row: number, col: number) {
    const key = `${row},${col}`;
    const existing = rooms.find((r) => roomKey(r) === key);
    if (existing) {
      setSelectedKey(key);
      return;
    }
    if (!rooms.some((r) => isAdjacent(r, { row, col }))) return;
    if (roomCount >= maxRooms) {
      setError(`Plafond de salles atteint (${maxRooms}). Améliorez "Expansion" pour en construire plus.`);
      return;
    }
    setSaved(false);
    setError(null);
    setRooms((prev) => [...prev, { row, col, type: "empty" }]);
    setSelectedKey(key);
  }

  function toggleGarrisonHero(heroId: string) {
    setSaved(false);
    setGarrisonHeroIds((prev) =>
      prev.includes(heroId) ? prev.filter((id) => id !== heroId) : [...prev, heroId],
    );
  }

  async function save() {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      await callApi("/api/dungeon/configure", { rooms, garrisonHeroIds });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const canSave = !overBudget && !overRoomCap && treasureCountValid && garrisonHeroIds.length <= garrisonCapacity;

  return (
    <PageTransition>
    <div className="space-y-6">
      <PageHeader
        title="Mon donjon"
        subtitle={
          <span className="flex flex-wrap gap-3">
            <span className={overBudget ? "text-red-400" : "text-slate-400"}>
              Budget : {pointsSpent}/{budget} pts
            </span>
            <span className={overRoomCap ? "text-red-400" : "text-slate-400"}>
              Salles : {roomCount}/{maxRooms}
            </span>
            <span className={treasureCountValid ? "text-slate-400" : "text-red-400"}>
              Trésors : {treasureRoomCount}/4
            </span>
            <span className="text-slate-400" title="Niveau moyen de vos 4 meilleurs héros : renforce vos monstres et ajoute du budget.">
              🛡️ Niveau de défense : {defenseLevel} (monstres ×{monsterScaleForDefenseLevel(defenseLevel).toFixed(1)})
            </span>
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Card textured>
          <p className="font-display mb-3 text-sm font-semibold text-slate-50">
            Disposition des salles
          </p>
          <DungeonGridEditor rooms={rooms} selectedKey={selectedKey} onCellClick={handleCellClick} />
          <p className="mt-3 text-xs text-slate-500">
            Cliquez une case adjacente à une salle existante pour en construire une nouvelle. Chaque
            salle doit être reliée à l&apos;entrée 🚪.
          </p>
        </Card>

        <Card textured accent={selectedRoom ? "gold" : "default"}>
          <p className="font-display mb-3 text-sm font-semibold text-slate-50">Salle sélectionnée</p>
          {!selectedRoom && <p className="text-sm text-slate-500">Sélectionnez une salle sur la grille.</p>}
          {selectedRoom && isEntranceSelected && (
            <p className="text-sm text-slate-500">L&apos;entrée reste toujours vide.</p>
          )}
          {selectedRoom && !isEntranceSelected && (
            <RoomInspector
              room={selectedRoom}
              maxOccupants={maxOccupants}
              trapcraftLevel={levels.trapcraft}
              capturedMonsters={capturedMonsters}
              canRemove={canRemoveRoom(selectedRoom)}
              onChange={updateRoom}
              onRemove={removeSelectedRoom}
            />
          )}
        </Card>
      </div>

      <Card>
        <p className="font-display mb-3 text-sm font-semibold text-slate-50">Garnison</p>
        <GarrisonPicker
          heroes={heroes}
          selectedIds={garrisonHeroIds}
          capacity={garrisonCapacity}
          onToggle={toggleGarrisonHero}
        />
        <p className="mt-2 text-xs text-slate-500">
          Les héros en garnison combattent aux côtés des monstres de vos salles lors d&apos;un raid.
        </p>
      </Card>

      <Card>
        <p className="font-display mb-3 text-sm font-semibold text-slate-50">Bestiaire capturé</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {MONSTERS.map((m) => {
            const count = capturedMonsters[m.id] ?? 0;
            const owned = count > 0;
            return (
              <Panel key={m.id} tone={owned ? "owned" : "neutral"} padding="sm" dim={!owned}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SpriteAnimation sheet={MONSTER_SPRITE[m.id]} frames={4} frameSize={32} className="h-6 w-6" />
                    <span className={owned ? "text-slate-100" : "text-slate-500"}>{m.name}</span>
                  </div>
                  {owned ? <Badge tone="success">x{count}</Badge> : <Badge tone="neutral">🔒</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{m.description}</p>
              </Panel>
            );
          })}
        </div>
      </Card>

      <Card>
        <p className="font-display mb-3 text-sm font-semibold text-slate-50">📜 Journal de défense</p>
        {defenseLog.length === 0 ? (
          <p className="text-sm text-slate-500">Personne n&apos;a encore osé attaquer votre donjon.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {defenseLog.map((entry) => (
              <li key={entry.at} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5">
                <span className="text-slate-300">
                  {entry.result === "defended" ? "🛡️" : entry.result === "fled" ? "🏃" : "💀"} {entry.attackerName}{" "}
                  <span className="text-xs text-slate-500">(Nv. {entry.attackerLevel})</span>
                </span>
                <span className="text-xs text-slate-400">
                  {entry.result === "defended" && `Repoussé${entry.fellIn ? ` (tombé en salle ${entry.fellIn})` : ""} · +${entry.crystalsGained} 💎`}
                  {entry.result === "fled" && `A fui avec ${entry.treasureReached}/${entry.treasureTotal} trésor(s) · −${entry.goldLost} or`}
                  {entry.result === "conquered" && `Donjon conquis · −${entry.goldLost} or`}
                  {" · "}
                  {new Date(entry.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Chaque attaque repoussée rapporte 2 💎 et de l&apos;or selon le niveau de l&apos;attaquant. Regardez où tombent vos adversaires pour
          renforcer les bonnes salles.
        </p>
      </Card>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-emerald-400">Donjon enregistré !</p>}

      <Button onClick={save} disabled={saving || !canSave}>
        {saving ? "Enregistrement..." : "Enregistrer le donjon"}
      </Button>
    </div>
    </PageTransition>
  );
}
