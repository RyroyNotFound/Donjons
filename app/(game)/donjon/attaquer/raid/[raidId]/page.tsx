"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { callApi } from "@/lib/api/client";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button, buttonClasses } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { Badge } from "@/components/Badge";
import { RARITY_LABEL } from "@/lib/ui/rarity";
import { EmptyState } from "@/components/EmptyState";
import { PageTransition } from "@/components/PageTransition";
import { RaidMap } from "@/components/dungeon/RaidMap";
import { HeroHpBar } from "@/components/dungeon/HeroHpBar";
import { RaidCombatLog } from "@/components/dungeon/RaidCombatLog";
import { RaidBattleScene } from "@/components/dungeon/RaidBattleScene";
import { Icon } from "@/components/Icon";
import { NavIcon } from "@/components/NavIcon";import { focusRing } from "@/lib/ui/a11y";
import type { IconName } from "@/lib/ui/icons";
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

function Reward({ icon, children }: { icon?: IconName; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

function BountyLine({ bounty }: { bounty: NonNullable<RaidView["bounty"]> }) {
  return (
    <div className="text-sm">
      <p className="font-semibold text-gold">Prime de conquête</p>
      <p className="mt-0.5 tabular-nums text-fg-muted">
        {bounty.gold > 0 && (
          <>
            <Reward icon="gold">{bounty.gold} or</Reward>
            {" · "}
          </>
        )}
        {bounty.forgeShards} éclats de forge
      </p>
      <p className="mt-1.5">
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
      <p className="font-semibold text-gold">Récompense de premier succès</p>
      <p className="mt-0.5 tabular-nums text-fg-muted">
        <Reward icon="gold">{reward.gold} or</Reward>
        {" · "}
        <Reward icon="crystal">{reward.crystals}</Reward>
        {" · "}
        <Reward>✦ {reward.stardust} poussière</Reward>
        {" · "}
        <Reward icon="rank-token">
          {reward.rankTokens} jeton{reward.rankTokens > 1 ? "s" : ""} de rang
        </Reward>
        {" · "}
        {reward.forgeShards} éclats de forge
      </p>
      <p className="mt-1.5">
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
    <div className="space-y-8">
      {showVictoryBanner && (
        <div className="dungeon-victory-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="raid-victory-title"
            className="dungeon-victory-card relative w-full max-w-sm overflow-hidden rounded-2xl border border-line-strong bg-surface p-6 shadow-[0_24px_48px_-12px_rgb(0_0_0/0.6)]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent"
            />
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
                <NavIcon name="trophy" className="h-6 w-6" />
              </span>
              <h2 id="raid-victory-title" className="font-display text-2xl font-semibold text-gold">
                Félicitations !
              </h2>
              {adventure ? (
                <>
                  <p className="text-sm leading-relaxed text-fg">
                    « {adventure.name} » est terminé
                    {adventure.index + 1 < ADVENTURE_STAGES.length ? " : le donjon suivant est débloqué." : " : vous avez achevé l'aventure !"}
                  </p>
                  {view.adventureReward ? (
                    <AdventureRewardLine reward={view.adventureReward} />
                  ) : (
                    <p className="text-sm text-fg-muted">Déjà terminé auparavant : pas de nouvelle récompense.</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-fg">Vous avez trouvé toutes les salles au trésor et conquis le donjon !</p>
                  <p className="text-sm font-semibold tabular-nums text-amber-300">Butin final : {formatLoot(view.bankedLoot)}</p>
                  {!!view.crystalsEarned && (
                    <p className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-sky-300">
                      <Icon name="crystal" className="h-4 w-4" />+{view.crystalsEarned} cristaux
                    </p>
                  )}
                  {view.bounty && <BountyLine bounty={view.bounty} />}
                </>
              )}
              <Button onClick={() => router.push(backHref, { transitionTypes: ["nav-back"] })} size="lg" className="mt-3 w-full">
                {adventure ? "Retour à l'aventure" : "Retour au menu"}
              </Button>
            </div>
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
          <h2 className="mb-4 font-semibold text-fg">Carte du donjon</h2>
          <RaidMap
            rooms={view.rooms}
            currentRoom={view.currentRoom}
            onEnterRoom={move}
            disabled={busy || finished || playing || view.status !== "in_progress"}
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-4 font-semibold text-fg">Votre équipe</h2>
            <div className="space-y-3">
              {shownHeroes.map((hero) => (
                <HeroHpBar key={hero.id} hero={hero} />
              ))}
            </div>
          </Card>

          {battleShown && (
            <Card accent={revealed > battle.to ? (battle.report.outcome === "cleared" ? "success" : "danger") : undefined}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-fg">Combat</h2>
                {playing && (
                  <div className="flex items-center gap-1.5">
                    <div className="inline-flex rounded-lg border border-line bg-white/[0.02] p-0.5" role="group" aria-label="Vitesse de lecture">
                      {SPEEDS.map((s, i) => (
                        <button
                          key={s.label}
                          type="button"
                          aria-pressed={i === speed}
                          onClick={() => setSpeed(i)}
                          className={`h-7 rounded-md px-2.5 text-xs tabular-nums transition-[background-color,color] duration-150 ease-out ${focusRing} ${
                            i === speed
                              ? "bg-surface-3 text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                              : "text-fg-muted hover:text-fg"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={skip} className={buttonClasses("ghost", "sm")}>
                      Passer
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
              <h2 className="font-semibold text-fg">Journal de combat</h2>
              {playing && !battleShown && (
                <button type="button" onClick={skip} className={buttonClasses("ghost", "sm")}>
                  Passer
                </button>
              )}
            </div>
            <p className="mb-2 text-[11px] text-fg-subtle">
              <span className="text-sky-400">▍</span> vos héros · <span className="text-red-400">▍</span> ennemis ·{" "}
              <span className="rounded bg-purple-400/15 px-1 text-purple-200">effet</span> sort déclenché
            </p>
            <RaidCombatLog entries={visible} roomTypes={roomTypes} />
          </Card>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}

      {view.status === "in_progress" && (
        <Button variant="danger" onClick={flee} disabled={busy || playing}>
          {adventure ? "Abandonner (sans pénalité)" : "Fuir avec le butin"}
        </Button>
      )}

      {finished && (
        <Card accent={view.status === "victory" ? "success" : view.status === "fled" ? "gold" : "danger"} className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">
            {view.status === "victory" && "Victoire totale !"}
            {view.status === "fled" && (adventure ? "Donjon abandonné" : "Retraite réussie")}
            {view.status === "wiped" && "Équipe anéantie..."}
          </h2>
          <p className="text-sm tabular-nums text-fg-muted">
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
          {!adventure && !!view.crystalsEarned && (
            <p className="flex items-center gap-1 text-sm tabular-nums text-sky-300">
              <Icon name="crystal" className="h-4 w-4" />+{view.crystalsEarned} cristaux
            </p>
          )}
          {view.bounty && <BountyLine bounty={view.bounty} />}
          {view.adventureReward && <AdventureRewardLine reward={view.adventureReward} />}
          <div className="pt-1">
            <Link href={backHref} transitionTypes={["nav-back"]} className={buttonClasses("secondary", "md")}>
              ← {adventure ? "Retour à l'aventure" : "Retour à l'attaque"}
            </Link>
          </div>
        </Card>
      )}
    </div>
    </PageTransition>
  );
}
