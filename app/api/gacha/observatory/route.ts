import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth, GameError } from "@/lib/api/handler";
import { CLASSES } from "@/lib/game/content/classes";
import { SPELLS } from "@/lib/game/content/spells";
import { TALENTS } from "@/lib/game/content/talents";
import { MASTERIES } from "@/lib/game/content/masteries";
import { observatoryPrice, RANK_TOKEN_PACK, type ObservatoryKind } from "@/lib/game/content/observatory";
import type { UserProfile } from "@/types/game";

interface Body {
  kind: ObservatoryKind | "rankTokens";
  refId?: string;
}

const POOLS: Record<ObservatoryKind, string[]> = {
  class: CLASSES.map((c) => c.id),
  spell: SPELLS.map((s) => s.id),
  talent: TALENTS.map((t) => t.id),
  mastery: MASTERIES.map((m) => m.id),
};

/** Spends stardust at the Observatoire: unlocks a chosen class/spell/talent/mastery, ranks an owned
 *  spell/talent/mastery up by one, or buys a pack of rank tokens. */
export const POST = withAuth(async (uid, request) => {
  const { kind, refId } = (await request.json()) as Body;
  const userRef = adminDb.collection("users").doc(uid);

  const result = await adminDb.runTransaction(async (tx) => {
    const user = (await tx.get(userRef)).data() as UserProfile;
    const stardust = user.stardust ?? 0;

    if (kind === "rankTokens") {
      if (stardust < RANK_TOKEN_PACK.price) throw new GameError("Poussière d'étoile insuffisante");
      tx.update(userRef, {
        stardust: stardust - RANK_TOKEN_PACK.price,
        rankTokens: (user.rankTokens ?? 0) + RANK_TOKEN_PACK.amount,
      });
      return { stardust: stardust - RANK_TOKEN_PACK.price };
    }

    if (!Object.hasOwn(POOLS, kind) || !refId || !POOLS[kind].includes(refId)) throw new GameError("Élément inconnu");

    if (kind === "class") {
      if (user.unlockedClasses.includes(refId)) throw new GameError("Classe déjà débloquée");
      const price = observatoryPrice("class", 0)!;
      if (stardust < price) throw new GameError("Poussière d'étoile insuffisante");
      tx.update(userRef, { stardust: stardust - price, unlockedClasses: [...user.unlockedClasses, refId] });
      return { stardust: stardust - price };
    }

    const currentRank = user.componentRanks[refId] ?? 0;
    const price = observatoryPrice(kind, currentRank);
    if (price === null) throw new GameError("Déjà au rang maximum");
    if (stardust < price) throw new GameError("Poussière d'étoile insuffisante");
    tx.update(userRef, {
      stardust: stardust - price,
      componentRanks: { ...user.componentRanks, [refId]: currentRank + 1 },
    });
    return { stardust: stardust - price };
  });

  return NextResponse.json(result);
});
