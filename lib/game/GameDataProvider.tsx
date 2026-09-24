"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { callApi } from "@/lib/api/client";
import type { Dungeon, DungeonUpgrades, Expedition, Hero, Item, UserProfile } from "@/types/game";

interface GameDataValue {
  profile: UserProfile | null;
  heroes: Hero[];
  items: Item[];
  dungeon: Dungeon | null;
  dungeonUpgrades: DungeonUpgrades | null;
  expeditions: Expedition[];
  loading: boolean;
}

const EMPTY_STATE: GameDataValue = {
  profile: null,
  heroes: [],
  items: [],
  dungeon: null,
  dungeonUpgrades: null,
  expeditions: [],
  loading: false,
};

const GameDataContext = createContext<GameDataValue>({ ...EMPTY_STATE, loading: true });

export function GameDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<GameDataValue>({ ...EMPTY_STATE, loading: true });
  const [trackedUid, setTrackedUid] = useState<string | null>(null);
  const uid = user?.uid ?? null;

  // Clear stale data as soon as the logged-in user changes, during render
  // rather than in the effect below (https://react.dev/learn/you-might-not-need-an-effect).
  if (uid !== trackedUid) {
    setTrackedUid(uid);
    setState(uid ? { ...EMPTY_STATE, loading: true } : EMPTY_STATE);
  }

  useEffect(() => {
    if (!user) return;

    callApi("/api/bootstrap").catch(console.error);

    const unsubscribers = [
      onSnapshot(doc(db, "users", user.uid), (snap) => {
        setState((prev) => ({
          ...prev,
          profile: (snap.data() as UserProfile) ?? null,
          loading: false,
        }));
      }),
      onSnapshot(query(collection(db, "heroes"), where("ownerId", "==", user.uid)), (snap) => {
        setState((prev) => ({ ...prev, heroes: snap.docs.map((d) => d.data() as Hero) }));
      }),
      onSnapshot(query(collection(db, "items"), where("ownerId", "==", user.uid)), (snap) => {
        setState((prev) => ({ ...prev, items: snap.docs.map((d) => d.data() as Item) }));
      }),
      onSnapshot(doc(db, "dungeons", user.uid), (snap) => {
        setState((prev) => ({ ...prev, dungeon: (snap.data() as Dungeon) ?? null }));
      }),
      onSnapshot(doc(db, "dungeonUpgrades", user.uid), (snap) => {
        setState((prev) => ({
          ...prev,
          dungeonUpgrades: (snap.data() as DungeonUpgrades) ?? null,
        }));
      }),
      onSnapshot(
        query(collection(db, "expeditions"), where("ownerId", "==", user.uid)),
        (snap) => {
          setState((prev) => ({
            ...prev,
            expeditions: snap.docs.map((d) => d.data() as Expedition),
          }));
        },
      ),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [user]);

  return <GameDataContext.Provider value={state}>{children}</GameDataContext.Provider>;
}

export function useGameData() {
  return useContext(GameDataContext);
}
