import "server-only";
import type { Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { GameError } from "@/lib/api/handler";
import type { Item, UserProfile } from "@/types/game";

/** Reads (inside a transaction) an item that must belong to `uid`, plus its owner's profile. */
export async function getOwnedItemInTx(tx: Transaction, uid: string, itemId: string) {
  const itemRef = adminDb.collection("items").doc(itemId);
  const userRef = adminDb.collection("users").doc(uid);
  const [itemSnap, userSnap] = await Promise.all([tx.get(itemRef), tx.get(userRef)]);
  if (!itemSnap.exists) throw new GameError("Objet introuvable");
  const item = itemSnap.data() as Item;
  if (item.ownerId !== uid) throw new GameError("Cet objet ne vous appartient pas");
  return { item, itemRef, user: userSnap.data() as UserProfile, userRef };
}
