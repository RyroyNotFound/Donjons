"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { callApi } from "@/lib/api/client";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { Badge } from "@/components/Badge";
import { RARITY_LABEL } from "@/lib/ui/rarity";
import { EmptyState } from "@/components/EmptyState";
import { PageTransition } from "@/components/PageTransition";
import { RaidMap } from "@/components/dungeon/RaidMap";
import { HeroHpBar } from "@/components/dungeon/HeroHpBar";
import { RaidCombatLog } from "@/components/dungeon/RaidCombatLog";
import { RaidBattleScene } from "@/components/dungeon/RaidBattleScene";
import { ADVENTURE_STAGES, getAdventureStage, STAGES_PER_WORLD } from "@/lib/game/content/adventure";
import type { DungeonRoomContentType, RaidHeroState, RaidLogEntry, RaidView, ResourceKind } from "@/types/game";

/** Playback speeds: milliseconds between two revealed log lines. */
const SPEEDS = [{ label: "×1", ms: 650 }, { label: "×2", ms: 320 }, { label: "×4", ms: 140 }];

/** Reveals log entries one at a time; `revealed` jumps to the end on skip. */
function useLogPlayback(total: number, intervalMs: number) {
  const [revealed, setRevealed] = useState(total);
  useEffect(() => {
    if (revealed >= total) return;
    const timeout = setTimeout(() => setRevealed((c) => Math.min(total, c + 1)), intervalMs);
    return () => clearTimeout(timeout);
  }, [total, revealed, intervalMs]);
  return { revealed: Math.min(revealed, total), playing: revealed < total, skip: () => setRevealed(total) };
}

const RESOURCE_LABEL: Record<ResourceKind, string> = {
  wood: "Bois",
  ore: "Minerai",
  essence: "Essence",
};

function BountyLine({ bounty }: { bounty: NonNullable<RaidView["bounty"]> }) {
  return (
    <div className="text-sm">
      <p className="font-semibold text-amber-200">Prime de conquête</p>
      <p className="text-slate-300">
        {bounty.gold > 0 && `${bounty.gold} or · `}
        {bounty.forgeShards} éclats de forge
      </p>
      <p className="mt-1">
        <Badge tone={bounty.item.rarity}>
          {RARITY_LABEL[bounty.item.rarity]} · {bounty.item.name} (palier {bounty.item.tier ?? 1})
        </Badge>
      </p>
    </div>
  );
}

function AdventureRewardLine({ reward }: { reward: NonNullable<RaidView["adventureReward"]> }) {
  return (
    <div className="text-sm">
      <p className="font-semibold text-amber-200">Récompense de premier succès</p>
      <p className="text-slate-300">
        {reward.gold} or · 💎 {reward.crystals} · ✦ {reward.stardust} poussière · {reward.rankTokens} jeton{reward.rankTokens > 1 ? "s" : ""} de rang ·{" "}
        {reward.forgeShards} éclats de forge
      </p>
      <p className="mt-1">
        <Badge tone={reward.item.rarity}>
          {RARITY_LABEL[reward.item.rarity]} · {reward.item.name} (palier {reward.item.tier ?? 1})
        </Badge>
      </p>
    </div>
  );
}

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
  /** Log length before the latest move, and the party as it was then (HP replays from there). */
  const [moveStart, setMoveStart] = useState(0);
  const [heroesBefore, setHeroesBefore] = useState<RaidHeroState[]>([]);
  const [speed, setSpeed] = useState(0);
  const { revealed, playing, skip } = useLogPlayback(log.length, SPEEDS[speed].ms);

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
      setMoveStart(log.length);
      setHeroesBefore(view?.heroes ?? res.heroes);
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

  const visible = log.slice(0, revealed);

  // The latest move's fight, if any: its entries revealed so far and its report (on its last entry).
  const battle = useMemo(() => {
    const moveEntries = log.slice(moveStart);
    const start = moveEntries.findIndex((e) => e.round !== undefined);
    if (start < 0) return null;
    const endOffset = moveEntries.slice(start).findIndex((e) => e.report);
    if (endOffset < 0) return null;
    const end = start + endOffset;
    return { from: moveStart + start, to: moveStart + end, report: moveEntries[end].report! };
  }, [log, moveStart]);

  const roomTypes = useMemo(() => {
    const types: Record<string, DungeonRoomContentType | undefined> = {};
    for (const r of view?.rooms ?? []) types[`${r.row},${r.col}`] = r.type;
    return types;
  }, [view]);

  // While the latest move plays back, HP follows the revealed lines instead of jumping to the result.
  const shownHeroes = useMemo(() => {
    if (!view) return [];
    if (!playing) return view.heroes;
    const hp = new Map(heroesBefore.map((h) => [h.id, h.hp]));
    for (const e of log.slice(moveStart, revealed)) if (e.targetId && e.hpAfter !== undefined && hp.has(e.targetId)) hp.set(e.targetId, e.hpAfter);
    return view.heroes.map((h) => ({ ...h, hp: hp.get(h.id) ?? h.hp }));
  }, [view, playing, heroesBefore, log, moveStart, revealed]);

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

  const adventure = view.adventureStageId ? getAdventureStage(view.adventureStageId) : null;
  const backHref = adventure ? "/aventure" : "/donjon/attaquer";
  const finished = view.status !== "in_progress" && !playing;
  const showVictoryBanner = view.status === "victory" && !playing;
  const battleShown = battle && revealed > battle.from;

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
                {adventure ? (
                  <>
                    <p className="text-sm text-slate-200">
                      « {adventure.name} » est terminé
                      {adventure.index + 1 < ADVENTURE_STAGES.length ? " : le donjon suivant est débloqué." : " : vous avez achevé l'aventure !"}
                    </p>
                    {view.adventureReward ? (
                      <AdventureRewardLine reward={view.adventureReward} />
                    ) : (
                      <p className="text-sm text-slate-400">Déjà terminé auparavant : pas de nouvelle récompense.</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-200">Vous avez trouvé toutes les salles au trésor et conquis le donjon !</p>
                    <p className="text-sm font-semibold text-amber-300">Butin final : {formatLoot(view.bankedLoot)}</p>
                    {!!view.crystalsEarned && <p className="text-sm font-semibold text-sky-300">💎 +{view.crystalsEarned} cristaux</p>}
                    {view.bounty && <BountyLine bounty={view.bounty} />}
                  </>
                )}
                <Button onClick={() => router.push(backHref, { transitionTypes: ["nav-back"] })} className="mt-2 w-full">
                  {adventure ? "Retour à l'aventure" : "Retour au menu"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      <PageHeader
        title={adventure ? `Aventure — ${adventure.name}` : "Raid en cours"}
        subtitle={
          adventure
            ? `Monde ${adventure.worldIndex + 1} · donjon ${adventure.stageIndex + 1}/${STAGES_PER_WORLD} · niveau ${adventure.defenseLevel} — objectif : atteindre le sceau (salle au trésor), gardé par la dernière salle de monstres.`
            : `Salles au trésor trouvées : ${view.treasureRoomsReached}/${view.treasureRoomsTotal} · Butin sécurisé : ${formatLoot(view.bankedLoot)}`
        }
      />

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Card textured>
          <p className="font-display mb-3 text-sm font-semibold text-slate-50">Carte du donjon</p>
          <RaidMap
            rooms={view.rooms}
            currentRoom={view.currentRoom}
            onEnterRoom={move}
            disabled={busy || finished || playing || view.status !== "in_progress"}
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <p className="font-display mb-3 text-sm font-semibold text-slate-50">Votre équipe</p>
            <div className="space-y-2">
              {shownHeroes.map((hero) => (
                <HeroHpBar key={hero.id} hero={hero} />
              ))}
            </div>
          </Card>

          {battleShown && (
            <Card accent={revealed > battle.to ? (battle.report.outcome === "cleared" ? "success" : "danger") : undefined}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-display text-sm font-semibold text-slate-50">Combat</p>
                {playing && (
                  <div className="flex items-center gap-1">
                    {SPEEDS.map((s, i) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => setSpeed(i)}
                        className={`rounded px-2 py-0.5 text-xs ${i === speed ? "bg-amber-500/30 text-amber-200" : "text-slate-400 hover:text-slate-200"}`}
                      >
                        {s.label}
                      </button>
                    ))}
                    <button type="button" onClick={skip} className="rounded px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200">
                      Passer ⏭
                    </button>
                  </div>
                )}
              </div>
              <RaidBattleScene
                entries={log.slice(battle.from, Math.min(revealed, battle.to + 1))}
                report={battle.report}
                done={revealed > battle.to}
              />
            </Card>
          )}

          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-display text-sm font-semibold text-slate-50">Journal de combat</p>
              {playing && !battleShown && (
                <button type="button" onClick={skip} className="text-xs text-slate-400 hover:text-slate-200">
                  Passer ⏭
                </button>
              )}
            </div>
            <p className="mb-2 text-[11px] text-slate-500">
              <span className="text-sky-300">▍</span> vos héros · <span className="text-red-300">▍</span> ennemis ·{" "}
              <span className="rounded bg-violet-500/20 px-1 text-violet-200">effet</span> sort déclenché
            </p>
            <RaidCombatLog entries={visible} roomTypes={roomTypes} />
          </Card>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {view.status === "in_progress" && (
        <Button variant="danger" onClick={flee} disabled={busy || playing}>
          {adventure ? "Abandonner (sans pénalité)" : "Fuir avec le butin"}
        </Button>
      )}

      {finished && (
        <Card accent={view.status === "victory" ? "success" : view.status === "fled" ? "gold" : "danger"}>
          <h2 className="font-display mb-2 text-lg font-bold text-slate-50">
            {view.status === "victory" && "Victoire totale !"}
            {view.status === "fled" && (adventure ? "Donjon abandonné" : "Retraite réussie")}
            {view.status === "wiped" && "Équipe anéantie..."}
          </h2>
          <p className="text-sm text-slate-300">
            {adventure
              ? view.status === "victory"
                ? view.adventureReward
                  ? "Récompense de premier succès obtenue."
                  : "Déjà terminé auparavant : pas de nouvelle récompense."
                : "Rien n'est perdu : réessayez quand vous voulez, avec une autre équipe si besoin."
              : view.status === "wiped"
                ? "Aucun butin récupéré."
                : `Butin final : ${formatLoot(view.bankedLoot)}`}
          </p>
          {!adventure && !!view.crystalsEarned && <p className="text-sm text-sky-300">💎 +{view.crystalsEarned} cristaux</p>}
          {view.bounty && <BountyLine bounty={view.bounty} />}
          {view.adventureReward && <AdventureRewardLine reward={view.adventureReward} />}
          <Link
            href={backHref}
            transitionTypes={["nav-back"]}
            className="mt-4 inline-block text-amber-400 hover:underline"
          >
            ← {adventure ? "Retour à l'aventure" : "Retour à l'attaque"}
          </Link>
        </Card>
      )}
    </div>
    </PageTransition>
  );
}
