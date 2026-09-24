"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { callApi } from "@/lib/api/client";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { PageTransition } from "@/components/PageTransition";
import { RaidMap } from "@/components/dungeon/RaidMap";
import { HeroHpBar } from "@/components/dungeon/HeroHpBar";
import { RaidCombatLog } from "@/components/dungeon/RaidCombatLog";
import type { RaidLogEntry, RaidView, ResourceKind } from "@/types/game";

const RESOURCE_LABEL: Record<ResourceKind, string> = {
  wood: "Bois",
  ore: "Minerai",
  essence: "Essence",
};

function formatLoot(loot: RaidView["bankedLoot"]): string {
  const parts = [`${loot.gold} or`];
  for (const [kind, amount] of Object.entries(loot.resources)) {
    if (amount) parts.push(`${amount} ${RESOURCE_LABEL[kind as ResourceKind]}`);
  }
  return parts.join(", ");
}

export default function RaidPage() {
  const { raidId } = useParams<{ raidId: string }>();
  const router = useRouter();
  const [view, setView] = useState<RaidView | null>(null);
  const [log, setLog] = useState<RaidLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callApi<{ view: RaidView | null }>("/api/dungeon/raid/active", undefined, "GET")
      .then((res) => {
        if (res.view && res.view.raidId === raidId) {
          setView(res.view);
        } else {
          setError("Ce raid n'est plus actif.");
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [raidId]);

  async function move(row: number, col: number) {
    setError(null);
    setBusy(true);
    try {
      const res = await callApi<RaidView>("/api/dungeon/raid/move", { raidId, row, col });
      setView(res);
      setLog((prev) => [...prev, ...res.newLog]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function flee() {
    setError(null);
    setBusy(true);
    try {
      const res = await callApi<RaidView>("/api/dungeon/raid/flee", { raidId });
      setView(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <PageTransition>
        <Spinner label="Chargement du raid..." />
      </PageTransition>
    );

  if (!view) {
    return (
      <PageTransition>
        <EmptyState
          message={error ?? "Raid introuvable."}
          backHref="/donjon/attaquer"
          backLabel="Retour à l'attaque"
        />
      </PageTransition>
    );
  }

  const finished = view.status !== "in_progress";
  const showVictoryBanner = view.status === "victory";

  return (
    <PageTransition>
    <div className="space-y-6">
      {showVictoryBanner && (
        <div className="dungeon-victory-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="dungeon-victory-card w-full max-w-sm">
            <Card accent="legendaire">
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <span className="text-5xl">🏆</span>
                <h2 className="text-glow-gold font-display text-2xl font-bold">Félicitations !</h2>
                <p className="text-sm text-slate-200">
                  Vous avez trouvé toutes les salles au trésor et conquis le donjon !
                </p>
                <p className="text-sm font-semibold text-amber-300">
                  Butin final : {formatLoot(view.bankedLoot)}
                </p>
                {!!view.crystalsEarned && <p className="text-sm font-semibold text-sky-300">💎 +{view.crystalsEarned} cristaux</p>}
                <Button
                  onClick={() => router.push("/donjon/attaquer", { transitionTypes: ["nav-back"] })}
                  className="mt-2 w-full"
                >
                  Retour au menu
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      <PageHeader
        title="Raid en cours"
        subtitle={`Salles au trésor trouvées : ${view.treasureRoomsReached}/${view.treasureRoomsTotal} · Butin sécurisé : ${formatLoot(view.bankedLoot)}`}
      />

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Card textured>
          <p className="font-display mb-3 text-sm font-semibold text-slate-50">Carte du donjon</p>
          <RaidMap
            rooms={view.rooms}
            currentRoom={view.currentRoom}
            onEnterRoom={move}
            disabled={busy || finished}
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <p className="font-display mb-3 text-sm font-semibold text-slate-50">Votre équipe</p>
            <div className="space-y-2">
              {view.heroes.map((hero) => (
                <HeroHpBar key={hero.id} hero={hero} />
              ))}
            </div>
          </Card>

          <Card>
            <p className="font-display mb-3 text-sm font-semibold text-slate-50">Journal de combat</p>
            <RaidCombatLog entries={log} />
          </Card>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!finished && (
        <Button variant="danger" onClick={flee} disabled={busy}>
          Fuir avec le butin
        </Button>
      )}

      {finished && (
        <Card accent={view.status === "victory" ? "success" : view.status === "fled" ? "gold" : "danger"}>
          <h2 className="font-display mb-2 text-lg font-bold text-slate-50">
            {view.status === "victory" && "Victoire totale !"}
            {view.status === "fled" && "Retraite réussie"}
            {view.status === "wiped" && "Équipe anéantie..."}
          </h2>
          <p className="text-sm text-slate-300">
            {view.status === "wiped" ? "Aucun butin récupéré." : `Butin final : ${formatLoot(view.bankedLoot)}`}
          </p>
          {!!view.crystalsEarned && <p className="text-sm text-sky-300">💎 +{view.crystalsEarned} cristaux</p>}
          <Link
            href="/donjon/attaquer"
            transitionTypes={["nav-back"]}
            className="mt-4 inline-block text-amber-400 hover:underline"
          >
            ← Retour à l&apos;attaque
          </Link>
        </Card>
      )}
    </div>
    </PageTransition>
  );
}
