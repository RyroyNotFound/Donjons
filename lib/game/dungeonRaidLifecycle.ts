import "server-only";

import type { DocumentReference } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { GameError } from "@/lib/api/handler";
import { getBotDungeon, isBotDefenderId } from "@/lib/game/content/botDungeons";
import { finalReward, stolenReward } from "@/lib/game/engine/dungeonRaid";
import { rollConquestBounty, type ConquestBounty } from "@/lib/game/engine/loot";
import type { BattleReward, DefenseLogEntry, DungeonRaid, Item, RaidStats, ResourceKind, UserProfile } from "@/types/game";

/** Paid to a defender whose dungeon wiped the attacking party, plus gold scaled on the attacker's level. */
const DEFENSE_WIN_CRYSTALS = 2;
const DEFENSE_WIN_GOLD_PER_ATTACKER_LEVEL = 8;
/** Conquering a real player's dungeon (every treasure room reached): base + 1 per 10 defense levels,
 *  +2 more if the dungeon was at least as strong as the attacking team. Paid once per dungeon per UTC day. */
const PVP_VICTORY_CRYSTALS = 2;
const PVP_UNDERDOG_BONUS = 2;
/** First conquest of each bot dungeon, by its tier (1..5); later conquests pay BOT_REPEAT_CRYSTALS. */
const BOT_FIRST_WIN_CRYSTALS = [3, 5, 8, 12, 18];
const BOT_REPEAT_CRYSTALS = 1;
/** Entries kept in a defender's journal. */
const DEFENSE_LOG_SIZE = 12;

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const EMPTY_RAID_STATS: RaidStats = { pvpWins: 0, botWins: 0, defenseWins: 0, lootStolen: 0 };

function rewardTotal(reward: BattleReward): number {
  return reward.gold + Object.values(reward.resources).reduce((sum, n) => sum + (n ?? 0), 0);
}

/** Saves one raid step atomically. `previous` is the raid as the route read it and `next` the
 *  result of applying the player's action; the write is refused if the stored raid moved on in
 *  between (double click, two tabs), so a step — and above all a payout — can never apply twice.
 *  When `next` is finished, the same transaction pays out the reward, debits a real defender's
 *  stash, bumps both sides' leaderboard counters, pays raid crystals and frees the attacker's
 *  heroes. A conquest also pays the conquest bounty (item + forge shards, + gold vs a real player —
 *  never debited from the defender). Returns what the attacker earned, or undefined while the raid goes on. */
export interface RaidPayout {
  crystals: number;
  bounty?: ConquestBounty;
}

export async function commitRaidStep(
  raidRef: DocumentReference,
  previous: DungeonRaid,
  next: DungeonRaid,
): Promise<RaidPayout | undefined> {
  const finished = next.status !== "in_progress";
  const reward = finalReward(next);
  /** Only this part comes out of a real defender's stash. */
  const stolen = stolenReward(next);
  const raid = next;
  const vsBot = isBotDefenderId(raid.defenderId);
  const attackerRef = adminDb.collection("users").doc(raid.attackerId);
  const defenderRef = vsBot ? null : adminDb.collection("users").doc(raid.defenderId);

  return adminDb.runTransaction(async (tx) => {
    // Firestore transactions need every read before the first write.
    const storedSnap = await tx.get(raidRef);
    const stored = storedSnap.data() as DungeonRaid | undefined;
    if (
      !stored ||
      stored.status !== "in_progress" ||
      stored.updatedAt !== previous.updatedAt ||
      stored.log.length !== previous.log.length
    ) {
      throw new GameError("Ce raid a déjà avancé : recharge la page");
    }
    if (!finished) {
      tx.set(raidRef, next);
      return undefined;
    }
    const attackerSnap = await tx.get(attackerRef);
    const defenderSnap = defenderRef ? await tx.get(defenderRef) : null;
    tx.set(raidRef, next);

    const attacker = attackerSnap.data() as UserProfile;
    const nextAttackerResources = { ...attacker.resources };
    for (const [kind, amount] of Object.entries(reward.resources) as [ResourceKind, number][]) {
      nextAttackerResources[kind] = (nextAttackerResources[kind] ?? 0) + amount;
    }
    const attackerStats = { ...EMPTY_RAID_STATS, ...attacker.raidStats };
    if (raid.status === "victory") {
      if (vsBot) attackerStats.botWins += 1;
      else attackerStats.pvpWins += 1;
    }
    if (!vsBot) attackerStats.lootStolen += rewardTotal(stolen);

    let crystalsEarned = 0;
    const botDungeonWins = { ...(attacker.botDungeonWins ?? {}) };
    const raidConquests = { ...(attacker.raidConquests ?? {}) };
    const defenseLevel = raid.defenderSnapshot.defenseLevel ?? 1;
    const today = utcDay(Date.now());
    if (raid.status === "victory") {
      if (vsBot) {
        const bot = getBotDungeon(raid.defenderId);
        const previousWins = botDungeonWins[bot.id] ?? 0;
        crystalsEarned = previousWins === 0 ? (BOT_FIRST_WIN_CRYSTALS[bot.tier - 1] ?? BOT_REPEAT_CRYSTALS) : BOT_REPEAT_CRYSTALS;
        botDungeonWins[bot.id] = previousWins + 1;
      } else if (raidConquests[raid.defenderId] !== today) {
        crystalsEarned =
          PVP_VICTORY_CRYSTALS +
          Math.floor(defenseLevel / 10) +
          (defenseLevel >= (raid.attackerLevel ?? 1) ? PVP_UNDERDOG_BONUS : 0);
        raidConquests[raid.defenderId] = today;
      }
    }

    const bounty = raid.status === "victory" ? rollConquestBounty(raid.seed, defenseLevel, vsBot) : undefined;
    if (bounty) {
      const itemRef = adminDb.collection("items").doc();
      const item: Item = { id: itemRef.id, ownerId: raid.attackerId, ...bounty.item, enhanceLevel: 0 };
      tx.set(itemRef, item);
    }

    tx.update(attackerRef, {
      gold: attacker.gold + reward.gold + (bounty?.gold ?? 0),
      forgeShards: (attacker.forgeShards ?? 0) + (bounty?.forgeShards ?? 0),
      resources: nextAttackerResources,
      raidStats: attackerStats,
      crystals: attacker.crystals + crystalsEarned,
      botDungeonWins,
      raidConquests,
    });

    if (defenderRef && defenderSnap?.exists) {
      const defender = defenderSnap.data() as UserProfile;
      const entry: DefenseLogEntry = {
        at: Date.now(),
        attackerName: raid.attackerName ?? "Aventurier inconnu",
        attackerLevel: raid.attackerLevel ?? 1,
        result: raid.status === "wiped" ? "defended" : raid.status === "victory" ? "conquered" : "fled",
        treasureReached: raid.treasureRoomsReached.length,
        treasureTotal: raid.defenderSnapshot.rooms.filter((r) => r.type === "treasure").length,
        goldLost: raid.status === "wiped" ? 0 : stolen.gold,
        ...(raid.status === "wiped" ? { fellIn: `${raid.currentRoom.row},${raid.currentRoom.col}` } : {}),
        crystalsGained: raid.status === "wiped" ? DEFENSE_WIN_CRYSTALS : 0,
      };
      const defenseLog = [entry, ...(defender.defenseLog ?? [])].slice(0, DEFENSE_LOG_SIZE);
      if (raid.status === "wiped") {
        const defenderStats = { ...EMPTY_RAID_STATS, ...defender.raidStats };
        defenderStats.defenseWins += 1;
        tx.update(defenderRef, {
          crystals: defender.crystals + DEFENSE_WIN_CRYSTALS,
          gold: defender.gold + DEFENSE_WIN_GOLD_PER_ATTACKER_LEVEL * (raid.attackerLevel ?? 1),
          raidStats: defenderStats,
          defenseLog,
        });
      } else {
        const nextDefenderResources = { ...defender.resources };
        for (const [kind, amount] of Object.entries(stolen.resources) as [ResourceKind, number][]) {
          nextDefenderResources[kind] = Math.max(0, (nextDefenderResources[kind] ?? 0) - amount);
        }
        tx.update(defenderRef, {
          gold: Math.max(0, defender.gold - stolen.gold),
          resources: nextDefenderResources,
          defenseLog,
        });
      }
    }

    for (const hero of raid.heroes) {
      tx.update(adminDb.collection("heroes").doc(hero.id), { status: "idle" });
    }
    return { crystals: crystalsEarned, bounty };
  });
}
