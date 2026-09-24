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
import { getHeroRole, heroElement, primaryRaidEffect } from "@/lib/game/engine/stats";
import { resistancesOf } from "@/lib/game/engine/elements";
import {
  DEFAULT_UPGRADE_LEVELS,
  dungeonDefenseLevel,
  trapDamageMultiplierForLevel,
} from "@/lib/game/content/dungeonUpgrades";
import type {
  BattleReward,
  Dungeon,
  DungeonRaid,
  DungeonUpgrades,
  Hero,
  RaidHeroState,
  UserProfile,
} from "@/types/game";

interface Body {
  defenderId: string;
  heroIds: string[];
}

/** Starts a new dungeon raid: resolves the target's layout into combat-ready state and places the attacker at the entrance. */
export const POST = withAuth(async (uid, request) => {
  const { defenderId, heroIds } = (await request.json()) as Body;
  if (defenderId === uid) throw new GameError("Vous ne pouvez pas attaquer votre propre donjon");
  if (!Array.isArray(heroIds) || heroIds.length === 0) throw new GameError("Sélectionnez au moins un héros");
  if (new Set(heroIds).size !== heroIds.length) throw new GameError("Un même héros ne peut pas être sélectionné deux fois");

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
  const attackerProfile = (await adminDb.collection("users").doc(uid).get()).data() as UserProfile | undefined;

  if (isBotDefenderId(defenderId)) {
    const bot = getBotDungeon(defenderId);
    dungeon = {
      ownerId: defenderId,
      rooms: bot.rooms,
      garrisonHeroIds: [],
      roomCount: bot.rooms.length - 1,
      treasureRoomCount: bot.rooms.filter((r) => r.type === "treasure").length,
      pointsSpent: 0,
      defenseLevel: bot.defenseLevel,
      updatedAt: 0,
    };
    totalLootPool = bot.loot;
    upgrades = { ownerId: defenderId, levels: DEFAULT_UPGRADE_LEVELS, updatedAt: 0 };
  } else {
    const [dungeonSnap, defenderSnap, upgradesSnap, defenderHeroesSnap] = await Promise.all([
      adminDb.collection("dungeons").doc(defenderId).get(),
      adminDb.collection("users").doc(defenderId).get(),
      adminDb.collection("dungeonUpgrades").doc(defenderId).get(),
      adminDb.collection("heroes").where("ownerId", "==", defenderId).get(),
    ]);
    if (!dungeonSnap.exists || !defenderSnap.exists) throw new GameError("Ce donjon n'existe pas");
    dungeon = dungeonSnap.data() as Dungeon;
    // Live defense level: the dungeon keeps up with its owner's heroes even without a re-save.
    const liveLevel = dungeonDefenseLevel(
      defenderHeroesSnap.docs.map((d) => d.data() as Hero).filter((h) => h.classId).map((h) => h.level),
    );
    dungeon = { ...dungeon, defenseLevel: Math.max(dungeon.defenseLevel ?? 1, liveLevel) };
    if (dungeon.treasureRoomCount < 1) throw new GameError("Ce donjon n'a pas de salle au trésor");
    upgrades = (upgradesSnap.data() as DungeonUpgrades | undefined) ?? {
      ownerId: defenderId,
      levels: DEFAULT_UPGRADE_LEVELS,
      updatedAt: 0,
    };
    totalLootPool = computeLootPool(defenderSnap.data() as UserProfile, upgrades, dungeon.defenseLevel);
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
        element: heroElement(hero),
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
      trapRes: stats.trapRes,
      crit: stats.crit,
      critDmg: stats.critDmg,
      element: heroElement(hero),
      res: resistancesOf(stats),
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
    trapDamageMultiplier: trapDamageMultiplierForLevel(upgrades.levels.trapcraft ?? 0),
    status: "in_progress",
    log: [],
    seed: `${uid}:${defenderId}:${Date.now()}`,
    attackerName: attackerProfile?.displayName ?? "Aventurier inconnu",
    attackerLevel: dungeonDefenseLevel(resolvedHeroes.map(({ hero }) => hero.level)),
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Re-check availability atomically: a hero sent on an expedition (or into another raid)
  // since the first read must not end up in two places at once.
  await adminDb.runTransaction(async (tx) => {
    const heroRefs = heroIds.map((heroId) => adminDb.collection("heroes").doc(heroId));
    const heroSnaps = await tx.getAll(...heroRefs);
    for (const snap of heroSnaps) {
      const hero = snap.data() as Hero | undefined;
      if (!hero || hero.status !== "idle") throw new GameError(`${hero?.name ?? "Un héros"} n'est pas disponible`);
    }
    tx.set(raidRef, raid);
    for (const ref of heroRefs) tx.update(ref, { status: "dungeon-raid" });
  });

  return NextResponse.json({ raidId: raid.id, view: toRaidView(raid) });
});
