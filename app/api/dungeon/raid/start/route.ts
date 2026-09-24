import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { loadOwnedHeroesWithStats } from "@/lib/game/heroLoader";
import {
  buildDefenderSnapshot,
  computeLootPool,
  toRaidView,
  type GarrisonMember,
} from "@/lib/game/engine/dungeonRaid";
import { getBotDungeon, isBotDefenderId } from "@/lib/game/content/botDungeons";
import { ENTRANCE_CELL } from "@/lib/game/content/dungeon";
import { getHeroRole, primaryRaidEffect } from "@/lib/game/engine/stats";
import type {
  BattleReward,
  Dungeon,
  DungeonRaid,
  DungeonUpgrades,
  RaidHeroState,
  UserProfile,
} from "@/types/game";

interface Body {
  defenderId: string;
  heroIds: string[];
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

/** Starts a new dungeon raid: resolves the target's layout into combat-ready state and places the attacker at the entrance. */
export const POST = withAuth(async (uid, request) => {
  const { defenderId, heroIds } = (await request.json()) as Body;
  if (defenderId === uid) throw new GameError("Vous ne pouvez pas attaquer votre propre donjon");
  if (heroIds.length === 0) throw new GameError("Sélectionnez au moins un héros");

  const activeSnap = await adminDb
    .collection("dungeonRaids")
    .where("attackerId", "==", uid)
    .where("status", "==", "in_progress")
    .limit(1)
    .get();
  if (!activeSnap.empty) throw new GameError("Un raid est déjà en cours");

  const resolvedHeroes = await loadOwnedHeroesWithStats(uid, heroIds);
  for (const { hero } of resolvedHeroes) {
    if (!hero.classId) throw new GameError(`${hero.name} n'a pas encore de classe assignée`);
    if (hero.status !== "idle") throw new GameError(`${hero.name} n'est pas disponible`);
  }

  let dungeon: Dungeon;
  let totalLootPool: BattleReward;
  let upgrades: DungeonUpgrades;

  if (isBotDefenderId(defenderId)) {
    const bot = getBotDungeon(defenderId);
    dungeon = {
      ownerId: defenderId,
      rooms: bot.rooms,
      garrisonHeroIds: [],
      roomCount: bot.rooms.length - 1,
      treasureRoomCount: bot.rooms.filter((r) => r.type === "treasure").length,
      pointsSpent: 0,
      updatedAt: 0,
    };
    totalLootPool = bot.loot;
    upgrades = { ownerId: defenderId, levels: DEFAULT_UPGRADE_LEVELS, updatedAt: 0 };
  } else {
    const [dungeonSnap, defenderSnap, upgradesSnap] = await Promise.all([
      adminDb.collection("dungeons").doc(defenderId).get(),
      adminDb.collection("users").doc(defenderId).get(),
      adminDb.collection("dungeonUpgrades").doc(defenderId).get(),
    ]);
    if (!dungeonSnap.exists || !defenderSnap.exists) throw new GameError("Ce donjon n'existe pas");
    dungeon = dungeonSnap.data() as Dungeon;
    if (dungeon.treasureRoomCount < 1) throw new GameError("Ce donjon n'a pas de salle au trésor");
    upgrades = (upgradesSnap.data() as DungeonUpgrades | undefined) ?? {
      ownerId: defenderId,
      levels: DEFAULT_UPGRADE_LEVELS,
      updatedAt: 0,
    };
    totalLootPool = computeLootPool(defenderSnap.data() as UserProfile, upgrades);
  }

  let garrison: GarrisonMember[] = [];
  if (dungeon.garrisonHeroIds.length > 0) {
    const resolvedGarrison = await loadOwnedHeroesWithStats(defenderId, dungeon.garrisonHeroIds);
    garrison = resolvedGarrison.map(({ hero, stats }) => {
      const raidEffect = primaryRaidEffect(hero);
      return {
        id: hero.id,
        name: hero.name,
        role: getHeroRole(hero)!,
        stats,
        raidEffectTag: raidEffect?.tag,
        raidEffectBonus: raidEffect?.bonus,
      };
    });
  }

  const { rooms, resolvedRoomOccupants } = buildDefenderSnapshot(dungeon, upgrades, garrison);

  const heroesState: RaidHeroState[] = resolvedHeroes.map(({ hero, stats }) => {
    const raidEffect = primaryRaidEffect(hero);
    return {
      id: hero.id,
      name: hero.name,
      role: getHeroRole(hero)!,
      maxHp: stats.hp,
      hp: stats.hp,
      atkPhys: stats.atkPhys,
      atkMag: stats.atkMag,
      defPhys: stats.defPhys,
      defMag: stats.defMag,
      spd: stats.spd,
      raidEffectTag: raidEffect?.tag,
      raidEffectBonus: raidEffect?.bonus,
    };
  });

  const raidRef = adminDb.collection("dungeonRaids").doc();
  const raid: DungeonRaid = {
    id: raidRef.id,
    attackerId: uid,
    defenderId,
    defenderSnapshot: dungeon,
    resolvedRoomOccupants,
    heroes: heroesState,
    currentRoom: { ...ENTRANCE_CELL },
    rooms,
    treasureRoomsReached: [],
    totalLootPool,
    bankedLoot: { gold: 0, resources: {} },
    status: "in_progress",
    log: [],
    seed: `${uid}:${defenderId}:${Date.now()}`,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  const batch = adminDb.batch();
  batch.set(raidRef, raid);
  for (const heroId of heroIds) {
    batch.update(adminDb.collection("heroes").doc(heroId), { status: "dungeon-raid" });
  }
  await batch.commit();

  return NextResponse.json({ raidId: raid.id, view: toRaidView(raid) });
});
