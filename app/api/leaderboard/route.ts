import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { getLeaderboard } from "@/lib/game/leaderboard";

/** Every category's top players plus the caller's own position (refreshed at most once a minute). */
export const GET = withAuth(async (uid) => {
  return NextResponse.json(await getLeaderboard(uid));
});
