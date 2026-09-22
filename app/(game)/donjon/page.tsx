"use client";

import { useState } from "react";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import {
  BOSSES,
  DUNGEON_POINT_BUDGET,
  MONSTERS,
  TRAPS,
} from "@/lib/game/content/dungeon";
import { Card } from "@/components/Card";
import type { Dungeon, DungeonRoomKind, DungeonRoomSlot } from "@/types/game";

function emptyRooms(): DungeonRoomSlot[] {
  return [1, 2, 3].map((slot) => ({ slot, kind: "empty" as DungeonRoomKind }));
}

function roomCost(room: DungeonRoomSlot): number {
  if (room.kind === "trap") return TRAPS.find((t) => t.id === room.refId)?.cost ?? 0;
  if (room.kind === "monster") return MONSTERS.find((m) => m.id === room.refId)?.cost ?? 0;
  return 0;
}

export default function DonjonPage() {
  const { dungeon } = useGameData();
  const [rooms, setRooms] = useState<DungeonRoomSlot[]>(emptyRooms());
  const [bossRefId, setBossRefId] = useState<string>("");
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
    setBossRefId(dungeon.bossRefId ?? "");
  }

  const pointsSpent = rooms.reduce((sum, r) => sum + roomCost(r), 0);
  const overBudget = pointsSpent > DUNGEON_POINT_BUDGET;

  function updateRoom(slot: number, kind: DungeonRoomKind, refId?: string) {
    setSaved(false);
    setRooms((prev) => prev.map((r) => (r.slot === slot ? { slot, kind, refId } : r)));
  }

  async function save() {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      await callApi("/api/dungeon/configure", {
        rooms,
        bossRefId: bossRefId || undefined,
      });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Mon donjon</h1>
        <p className={`text-sm ${overBudget ? "text-red-400" : "text-zinc-400"}`}>
          Budget : {pointsSpent}/{DUNGEON_POINT_BUDGET} points
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {rooms.map((room) => (
          <Card key={room.slot}>
            <p className="mb-2 text-sm font-semibold text-zinc-50">Salle {room.slot}</p>
            <select
              value={room.kind}
              onChange={(e) => {
                const kind = e.target.value as DungeonRoomKind;
                updateRoom(room.slot, kind, undefined);
              }}
              className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100"
            >
              <option value="empty">Vide</option>
              <option value="trap">Piège</option>
              <option value="monster">Monstre</option>
            </select>

            {room.kind === "trap" && (
              <select
                value={room.refId ?? ""}
                onChange={(e) => updateRoom(room.slot, "trap", e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100"
              >
                <option value="">Choisir un piège</option>
                {TRAPS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.cost} pts)
                  </option>
                ))}
              </select>
            )}

            {room.kind === "monster" && (
              <select
                value={room.refId ?? ""}
                onChange={(e) => updateRoom(room.slot, "monster", e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100"
              >
                <option value="">Choisir un monstre</option>
                {MONSTERS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.cost} pts)
                  </option>
                ))}
              </select>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <p className="mb-2 text-sm font-semibold text-zinc-50">Boss (optionnel)</p>
        <select
          value={bossRefId}
          onChange={(e) => {
            setSaved(false);
            setBossRefId(e.target.value);
          }}
          className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100"
        >
          <option value="">Aucun boss</option>
          {BOSSES.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Card>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-emerald-400">Donjon enregistré !</p>}

      <button
        onClick={save}
        disabled={saving || overBudget}
        className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Enregistrement..." : "Enregistrer le donjon"}
      </button>
    </div>
  );
}
