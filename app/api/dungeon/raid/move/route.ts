import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { createRng } from "@/lib/game/engine/rng";
import { applyMove, toRaidView } from "@/lib/game/engine/dungeonRaid";
import { commitRaidStep } from "@/lib/game/dungeonRaidLifecycle";
import type { DungeonRaid } from "@/types/game";

interface Body {
  raidId: string;
  row: number;
  col: number;
}

/** Moves the attacker into an adjacent room and resolves whatever's in it: trap, monster fight, or treasure. */
export const POST = withAuth(async (uid, request) => {
  const { raidId, row, col } = (await request.json()) as Body;
  const raidRef = adminDb.collection("dungeonRaids").doc(raidId);
  const raidSnap = await raidRef.get();
  if (!raidSnap.exists) throw new GameError("Raid introuvable");
  const raid = raidSnap.data() as DungeonRaid;
  if (raid.attackerId !== uid) throw new GameError("Ce raid ne vous appartient pas");

  const rng = createRng(`${raid.seed}:${raid.log.length}:${row}:${col}`);
  const { raid: nextRaid, newLog } = applyMove(raid, { row, col }, rng);

  const payout = await commitRaidStep(raidRef, raid, nextRaid);
  const bounty = payout?.bounty;
  const adventure = payout?.adventure;

  return NextResponse.json({
    ...toRaidView(nextRaid, newLog),
    crystalsEarned: payout?.crystals,
    bounty: bounty && {
      gold: bounty.gold,
      forgeShards: bounty.forgeShards,
      item: { name: bounty.item.name, rarity: bounty.item.rarity, slot: bounty.item.slot, tier: bounty.item.tier },
    },
    adventureReward: adventure && {
      gold: adventure.reward.gold,
      crystals: adventure.reward.crystals,
      stardust: adventure.reward.stardust,
      rankTokens: adventure.reward.rankTokens,
      forgeShards: adventure.reward.forgeShards,
      item: { name: adventure.item.name, rarity: adventure.item.rarity, slot: adventure.item.slot, tier: adventure.item.tier },
    },
  });
});
