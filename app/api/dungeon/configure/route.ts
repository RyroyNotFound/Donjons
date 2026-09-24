import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import {
  MONSTERS,
  TREASURE_ROOM_COST,
  getMonster,
  getTrap,
  trapTierUnlockedAtLevel,
} from "@/lib/game/content/dungeon";
import { validateDungeonLayout } from "@/lib/game/engine/dungeonLayout";
import {
  garrisonCapacityForLevel,
  maxOccupantsForLevel,
  maxRoomsForLevel,
  pointBudgetForLevel,
} from "@/lib/game/content/dungeonUpgrades";
import type { Dungeon, DungeonRoomCell, DungeonUpgrades, Hero, UserProfile } from "@/types/game";

interface Body {
  rooms: DungeonRoomCell[];
  garrisonHeroIds: string[];
}

const DEFAULT_UPGRADE_LEVELS: DungeonUpgrades["levels"] = {
  expansion: 0,
  architecture: 0,
  defenderVigor: 0,
  trapcraft: 0,
  beastMastery: 0,
  hazardDensity: 0,
  vaultCapacity: 0,
  heroSlots: 0,
};

/** Saves the caller's dungeon layout after validating connectivity, upgrade-gated caps/budget, and
    that every placed non-boss monster was actually captured (via expedition drop or gacha fragment). */
export const POST = withAuth(async (uid, request) => {
  const { rooms, garrisonHeroIds } = (await request.json()) as Body;

  const validation = validateDungeonLayout(rooms);
  if (!validation.ok) throw new GameError(validation.reason);

  const [userSnap, upgradesSnap, dungeonSnap, heroesSnap] = await Promise.all([
    adminDb.collection("users").doc(uid).get(),
    adminDb.collection("dungeonUpgrades").doc(uid).get(),
    adminDb.collection("dungeons").doc(uid).get(),
    adminDb.collection("heroes").where("ownerId", "==", uid).get(),
  ]);

  const capturedMonsters = (userSnap.data() as UserProfile | undefined)?.capturedMonsters ?? {};
  const levels = (upgradesSnap.data() as DungeonUpgrades | undefined)?.levels ?? DEFAULT_UPGRADE_LEVELS;
  const previousGarrison = new Set((dungeonSnap.data() as Dungeon | undefined)?.garrisonHeroIds ?? []);
  const heroesById = new Map(heroesSnap.docs.map((d) => [d.id, d.data() as Hero]));

  const roomCount = rooms.length - 1;
  const maxRooms = maxRoomsForLevel(levels.expansion);
  if (roomCount > maxRooms) {
    throw new GameError(`Trop de salles : ${roomCount}/${maxRooms}`);
  }

  const maxOccupants = maxOccupantsForLevel(levels.hazardDensity);
  let pointsSpent = 0;
  const monsterUsage: Record<string, number> = {};

  for (const room of rooms) {
    if (room.type === "trap") {
      const trapIds = room.trapIds ?? [];
      if (trapIds.length === 0) throw new GameError("Une salle piège doit contenir au moins un piège");
      if (trapIds.length > maxOccupants) throw new GameError("Trop de pièges empilés dans une salle");
      for (const trapId of trapIds) {
        const trap = getTrap(trapId);
        if (levels.trapcraft < trapTierUnlockedAtLevel(trap.tier)) {
          throw new GameError(`Le piège "${trap.name}" n'est pas encore débloqué`);
        }
        pointsSpent += trap.cost;
      }
    } else if (room.type === "monster") {
      const monsterRefIds = room.monsterRefIds ?? [];
      if (monsterRefIds.length === 0) {
        throw new GameError("Une salle monstre doit contenir au moins un monstre");
      }
      if (monsterRefIds.length > maxOccupants) {
        throw new GameError("Trop de monstres empilés dans une salle");
      }
      for (const refId of monsterRefIds) {
        const monster = getMonster(refId);
        if (!monster.isBoss) monsterUsage[refId] = (monsterUsage[refId] ?? 0) + 1;
        pointsSpent += monster.cost;
      }
    } else if (room.type === "treasure") {
      pointsSpent += TREASURE_ROOM_COST;
    }
  }

  for (const [refId, used] of Object.entries(monsterUsage)) {
    if ((capturedMonsters[refId] ?? 0) < used) {
      const name = MONSTERS.find((m) => m.id === refId)?.name ?? refId;
      throw new GameError(`Vous n'avez pas assez capturé "${name}" (${used} requis)`);
    }
  }

  const budget = pointBudgetForLevel(levels.architecture);
  if (pointsSpent > budget) throw new GameError(`Budget dépassé : ${pointsSpent}/${budget} points`);

  const capacity = garrisonCapacityForLevel(levels.defenderVigor);
  if (garrisonHeroIds.length > capacity) {
    throw new GameError(`Capacité de garnison dépassée : ${garrisonHeroIds.length}/${capacity}`);
  }
  for (const heroId of garrisonHeroIds) {
    const hero = heroesById.get(heroId);
    if (!hero) throw new GameError("Un héros de garnison sélectionné ne vous appartient pas");
    if (!hero.classId) throw new GameError(`${hero.name} n'a pas encore de classe assignée`);
    if (hero.status !== "idle" && hero.status !== "dungeon-guard") {
      throw new GameError(`${hero.name} n'est pas disponible pour monter la garde`);
    }
  }

  const treasureRoomCount = rooms.filter((r) => r.type === "treasure").length;

  const batch = adminDb.batch();
  batch.set(adminDb.collection("dungeons").doc(uid), {
    ownerId: uid,
    rooms,
    garrisonHeroIds,
    roomCount,
    treasureRoomCount,
    pointsSpent,
    updatedAt: Date.now(),
  });

  const nextGarrison = new Set(garrisonHeroIds);
  for (const heroId of new Set([...previousGarrison, ...nextGarrison])) {
    const hero = heroesById.get(heroId);
    if (!hero) continue;
    if (nextGarrison.has(heroId) && hero.status !== "dungeon-guard") {
      batch.update(adminDb.collection("heroes").doc(heroId), { status: "dungeon-guard" });
    } else if (!nextGarrison.has(heroId) && hero.status === "dungeon-guard") {
      batch.update(adminDb.collection("heroes").doc(heroId), { status: "idle" });
    }
  }

  await batch.commit();

  return NextResponse.json({ ok: true, pointsSpent, roomCount, treasureRoomCount });
});
