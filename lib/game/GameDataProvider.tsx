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
  /** Set when the profile could not be loaded (bootstrap or a listener failed). */
  error: string | null;
  /** Technical detail of the failure (which source, error code), shown small for bug reports. */
  errorDetail: string | null;
  /** Re-runs bootstrap and re-subscribes every listener after an error. */
  retry: () => void;
}

const EMPTY_STATE: GameDataValue = {
  profile: null,
  heroes: [],
  items: [],
  dungeon: null,
  dungeonUpgrades: null,
  expeditions: [],
  loading: false,
  error: null,
  errorDetail: null,
  retry: () => {},
};

const LOAD_ERROR = "Impossible de charger votre profil. Vérifiez votre connexion puis réessayez.";

const GameDataContext = createContext<GameDataValue>({ ...EMPTY_STATE, loading: true });

export function GameDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<GameDataValue>({ ...EMPTY_STATE, loading: true });
  const [trackedUid, setTrackedUid] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const uid = user?.uid ?? null;

  // Clear stale data as soon as the logged-in user changes, during render
  // rather than in the effect below (https://react.dev/learn/you-might-not-need-an-effect).
  if (uid !== trackedUid) {
    setTrackedUid(uid);
    setState(uid ? { ...EMPTY_STATE, loading: true } : EMPTY_STATE);
  }

  useEffect(() => {
    if (!user) return;

    const fail = (source: string) => (err: unknown) => {
      console.error(source, err);
      const { code, message } = (err ?? {}) as { code?: string; message?: string };
      const detail = `${source} : ${code ?? message ?? String(err)}`;
      // Keep the first failure: later ones are usually knock-on effects.
      setState((prev) => (prev.error ? prev : { ...prev, error: LOAD_ERROR, errorDetail: detail }));
    };
    callApi("/api/bootstrap").catch(fail("bootstrap"));

    const unsubscribers = [
      onSnapshot(doc(db, "users", user.uid), (snap) => {
        setState((prev) => ({
          ...prev,
          profile: (snap.data() as UserProfile) ?? null,
          loading: false,
        }));
      }, fail("users")),
      onSnapshot(query(collection(db, "heroes"), where("ownerId", "==", user.uid)), (snap) => {
        setState((prev) => ({ ...prev, heroes: snap.docs.map((d) => d.data() as Hero) }));
      }, fail("heroes")),
      onSnapshot(query(collection(db, "items"), where("ownerId", "==", user.uid)), (snap) => {
        setState((prev) => ({ ...prev, items: snap.docs.map((d) => d.data() as Item) }));
      }, fail("items")),
      onSnapshot(doc(db, "dungeons", user.uid), (snap) => {
        setState((prev) => ({ ...prev, dungeon: (snap.data() as Dungeon) ?? null }));
      }, fail("dungeons")),
      onSnapshot(doc(db, "dungeonUpgrades", user.uid), (snap) => {
        setState((prev) => ({
          ...prev,
          dungeonUpgrades: (snap.data() as DungeonUpgrades) ?? null,
        }));
      }, fail("dungeonUpgrades")),
      onSnapshot(
        query(collection(db, "expeditions"), where("ownerId", "==", user.uid)),
        (snap) => {
          setState((prev) => ({
            ...prev,
            expeditions: snap.docs.map((d) => d.data() as Expedition),
          }));
        },
        fail("expeditions"),
      ),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [user, attempt]);

  const value: GameDataValue = {
    ...state,
    retry: () => {
      setState((prev) => ({ ...prev, error: null, errorDetail: null }));
      setAttempt((n) => n + 1);
    },
  };
  return <GameDataContext.Provider value={value}>{children}</GameDataContext.Provider>;
}

export function useGameData() {
  return useContext(GameDataContext);
}
