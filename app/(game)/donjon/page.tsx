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
import { Icon } from "@/components/Icon";
import { MONSTER_SPRITE } from "@/lib/ui/monsterSprites";
import { DungeonGridEditor } from "@/components/dungeon/DungeonGridEditor";
import { RoomInspector } from "@/components/dungeon/RoomInspector";
import { GarrisonPicker } from "@/components/dungeon/GarrisonPicker";
import type { Dungeon, DungeonRoomCell } from "@/types/game";

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

  const stats: { label: string; value: React.ReactNode; bad: boolean; title?: string }[] = [
    { label: "Budget", value: <>{pointsSpent}<span className="text-fg-faint">/{budget} pts</span></>, bad: overBudget },
    { label: "Salles", value: <>{roomCount}<span className="text-fg-faint">/{maxRooms}</span></>, bad: overRoomCap },
    { label: "Trésors", value: <>{treasureRoomCount}<span className="text-fg-faint">/4</span></>, bad: !treasureCountValid },
    {
      label: "Niveau de défense",
      value: (
        <>
          {defenseLevel}
          <span className="ml-1.5 text-xs font-normal text-fg-subtle">
            (monstres ×{monsterScaleForDefenseLevel(defenseLevel).toFixed(1)})
          </span>
        </>
      ),
      bad: false,
      title: "Niveau moyen de vos 4 meilleurs héros : renforce vos monstres et ajoute du budget.",
    },
  ];

  return (
    <PageTransition>
    <div className="space-y-8">
      <PageHeader title="Mon donjon" />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            title={stat.title}
            className={`rounded-xl border px-4 py-3 ${stat.bad ? "border-red-400/25 bg-red-400/[0.05]" : "border-line bg-surface"}`}
          >
            <dt className={`text-xs ${stat.bad ? "text-red-300" : "text-fg-subtle"}`}>{stat.label}</dt>
            <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${stat.bad ? "text-red-300" : "text-fg"}`}>{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Card textured>
          <h2 className="mb-4 font-semibold text-fg">Disposition des salles</h2>
          <DungeonGridEditor rooms={rooms} selectedKey={selectedKey} onCellClick={handleCellClick} />
          <p className="mt-3 max-w-md text-xs leading-relaxed text-fg-subtle">
            Cliquez une case adjacente à une salle existante pour en construire une nouvelle. Chaque
            salle doit être reliée à l&apos;entrée 🚪.
          </p>
        </Card>

        <Card accent={selectedRoom ? "gold" : "default"}>
          <h2 className="mb-4 font-semibold text-fg">Salle sélectionnée</h2>
          {!selectedRoom && <p className="text-sm text-fg-subtle">Sélectionnez une salle sur la grille.</p>}
          {selectedRoom && isEntranceSelected && (
            <p className="text-sm text-fg-subtle">L&apos;entrée reste toujours vide.</p>
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
        <h2 className="mb-4 font-semibold text-fg">Garnison</h2>
        <GarrisonPicker
          heroes={heroes}
          selectedIds={garrisonHeroIds}
          capacity={garrisonCapacity}
          onToggle={toggleGarrisonHero}
        />
        <p className="mt-2 text-xs text-fg-subtle">
          Les héros en garnison combattent aux côtés des monstres de vos salles lors d&apos;un raid.
        </p>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold text-fg">Bestiaire capturé</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {MONSTERS.map((m) => {
            const count = capturedMonsters[m.id] ?? 0;
            const owned = count > 0;
            return (
              <Panel key={m.id} tone={owned ? "owned" : "neutral"} padding="sm" dim={!owned}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <SpriteAnimation sheet={MONSTER_SPRITE[m.id]} frames={4} frameSize={32} className="h-6 w-6 shrink-0" />
                    <span className={`truncate text-sm font-medium ${owned ? "text-fg" : "text-fg-subtle"}`}>{m.name}</span>
                  </div>
                  {owned ? (
                    <Badge tone="success" className="tabular-nums">x{count}</Badge>
                  ) : (
                    <Badge tone="neutral">
                      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                        <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
                        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" strokeLinecap="round" />
                      </svg>
                      <span className="sr-only">Non capturé</span>
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-fg-subtle">{m.description}</p>
              </Panel>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold text-fg">Journal de défense</h2>
        {defenseLog.length === 0 ? (
          <p className="text-sm text-fg-subtle">Personne n&apos;a encore osé attaquer votre donjon.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white/[0.025] text-sm">
            {defenseLog.map((entry) => (
              <li key={entry.at} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-fg">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      entry.result === "defended" ? "bg-emerald-400" : entry.result === "fled" ? "bg-gold" : "bg-red-400"
                    }`}
                  />
                  {entry.attackerName}
                  <span className="text-xs tabular-nums text-fg-subtle">(Nv. {entry.attackerLevel})</span>
                </span>
                <span className="inline-flex flex-wrap items-center gap-x-1 text-xs tabular-nums text-fg-muted">
                  {entry.result === "defended" && (
                    <>
                      <span className="text-emerald-300">Repoussé{entry.fellIn ? ` (tombé en salle ${entry.fellIn})` : ""}</span>
                      {" · "}
                      <span className="inline-flex items-center gap-0.5 text-sky-200">
                        +{entry.crystalsGained}
                        <Icon name="crystal" label="cristaux" className="h-3.5 w-3.5" />
                      </span>
                    </>
                  )}
                  {entry.result === "fled" && `A fui avec ${entry.treasureReached}/${entry.treasureTotal} trésor(s) · −${entry.goldLost} or`}
                  {entry.result === "conquered" && <span className="text-red-300">Donjon conquis · −{entry.goldLost} or</span>}
                  <span className="text-fg-subtle">
                    {" · "}
                    {new Date(entry.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
          Chaque attaque repoussée rapporte 2 <Icon name="crystal" label="cristaux" className="-mt-0.5 h-3.5 w-3.5 align-middle" /> et de
          l&apos;or selon le niveau de l&apos;attaquant. Regardez où tombent vos adversaires pour renforcer les bonnes salles.
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button onClick={save} disabled={saving || !canSave}>
          {saving ? "Enregistrement..." : "Enregistrer le donjon"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        {saved && (
          <p className="flex items-center gap-1.5 text-sm text-emerald-300">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
              <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Donjon enregistré !
          </p>
        )}
      </div>
    </div>
    </PageTransition>
  );
}
