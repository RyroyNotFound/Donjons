"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { ZONES, isZoneUnlocked } from "@/lib/game/content/zones";
import { equippedItemsOf, heroPower, resolveHeroStats } from "@/lib/game/engine/stats";
import { tryGetClass } from "@/lib/game/content/classes";
import { tryGetSpell } from "@/lib/game/content/spells";
import { ARENA_SPELL_TAGS } from "@/lib/game/arena/engine";
import { DIFFICULTIES, getDifficulty, isDifficultyUnlocked, recordKey, zoneAtDifficulty } from "@/lib/game/content/difficulties";
import { getMonster } from "@/lib/game/content/dungeon";
import { ELEMENT_ICON, ELEMENTS, RES_KEY } from "@/lib/game/engine/elements";
import { focusRing } from "@/lib/ui/a11y";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button, buttonClasses } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { PageTransition } from "@/components/PageTransition";
import type { Difficulty, Element, ResourceKind, ZoneDefinition } from "@/types/game";

const RESOURCE_LABEL: Record<ResourceKind, string> = { wood: "Bois", ore: "Minerai", essence: "Essence" };

function StarRow({ count }: { count: number }) {
  return (
    <span aria-label={`${count} étoile(s) sur 3`} className="tracking-tight">
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= count ? "text-gold" : "text-fg-faint"}>
          ★
        </span>
      ))}
    </span>
  );
}

function LockGlyph({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" strokeLinecap="round" />
    </svg>
  );
}

/** Elements the zone's monsters attack with, and elements they are weak to (any monster of the pool or the boss). */
function zoneElements(zone: ZoneDefinition): { attacks: Element[]; weaknesses: Element[] } {
  const monsters = [...new Set([...zone.monsterPool, zone.boss.refId])].map(getMonster);
  return {
    attacks: ELEMENTS.filter((e) => monsters.some((m) => m.element === e)),
    weaknesses: ELEMENTS.filter((e) => monsters.some((m) => m.stats[RES_KEY[e]] < 0)),
  };
}

/** Colour/label for how a team's power compares to a zone's recommended power. */
function powerVerdict(power: number, zone: ZoneDefinition): { label: string; className: string } {
  const ratio = power / zone.recommendedPower;
  if (ratio >= 1.25) return { label: "Confortable", className: "text-emerald-300" };
  if (ratio >= 0.9) return { label: "Équilibré", className: "text-amber-300" };
  if (ratio >= 0.6) return { label: "Risqué", className: "text-orange-300" };
  return { label: "Très dangereux", className: "text-red-300" };
}

export default function ExpeditionsPage() {
  const router = useRouter();
  const { heroes, items, expeditions, profile } = useGameData();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [selectedHeroes, setSelectedHeroes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [abandoningId, setAbandoningId] = useState<string | null>(null);

  const records = profile?.expeditionRecords;
  const baseZone = selectedZone ? ZONES.find((z) => z.id === selectedZone) : undefined;
  const zone = baseZone ? zoneAtDifficulty(baseZone, difficulty) : undefined;
  const activeExpeditions = expeditions.filter((e) => e.status === "active");

  const powerByHero = useMemo(() => {
    const map = new Map<string, number>();
    for (const hero of heroes) {
      map.set(hero.id, heroPower(resolveHeroStats(hero, equippedItemsOf(hero, items), profile?.componentRanks)));
    }
    return map;
  }, [heroes, items, profile?.componentRanks]);

  const idleHeroes = heroes
    .filter((h) => h.status === "idle")
    .sort((a, b) => (powerByHero.get(b.id) ?? 0) - (powerByHero.get(a.id) ?? 0));
  const teamPower = selectedHeroes
    .filter((id) => idleHeroes.some((h) => h.id === id))
    .reduce((sum, id) => sum + (powerByHero.get(id) ?? 0), 0);

  function selectZone(z: ZoneDefinition) {
    setSelectedZone(z.id);
    // Default to the hardest difficulty open on this zone.
    const open = DIFFICULTIES.filter((d) => isDifficultyUnlocked(z.id, d.id, records));
    setDifficulty(open[open.length - 1]?.id ?? "normal");
    // Keep the player's own picks (they used to be overwritten by an auto-filled team, so clicking
    // a pre-selected hero removed it and the launched team wasn't the one they picked).
    setSelectedHeroes((prev) => prev.filter((id) => idleHeroes.some((h) => h.id === id)).slice(0, z.heroSlots));
  }

  function autoTeam() {
    if (!zone) return;
    setSelectedHeroes(idleHeroes.slice(0, zone.heroSlots).map((h) => h.id));
  }

  function toggleHero(heroId: string) {
    if (!zone) return;
    setSelectedHeroes((prev) => {
      if (prev.includes(heroId)) return prev.filter((id) => id !== heroId);
      if (prev.length >= zone.heroSlots) return prev;
      return [...prev, heroId];
    });
  }

  // Only heroes still idle and within the zone's slot count — exactly what the chips show as picked.
  const team = zone
    ? selectedHeroes.filter((id) => idleHeroes.some((h) => h.id === id)).slice(0, zone.heroSlots)
    : [];
  const teamFull = !!zone && team.length >= zone.heroSlots;

  async function start() {
    if (!selectedZone || team.length === 0) return;
    setError(null);
    setStarting(true);
    try {
      const res = await callApi<{ expeditionId: string }>("/api/expeditions/start", {
        zoneId: selectedZone,
        heroIds: team,
        difficulty,
      });
      router.push(`/expeditions/jouer/${res.expeditionId}`, { transitionTypes: ["nav-forward"] });
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  }

  async function abandon(expeditionId: string) {
    setError(null);
    setAbandoningId(expeditionId);
    try {
      await callApi("/api/expeditions/abandon", { expeditionId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAbandoningId(null);
    }
  }

  return (
    <PageTransition>
      <div className="space-y-8">
        <PageHeader
          title="Expéditions"
          subtitle="Des sessions d'une minute : survivez aux vagues, battez le boss, rapportez le butin. La puissance de vos héros fait tout."
        />

        {activeExpeditions.length > 0 && (
          <section>
            <h2 className="mb-3 font-semibold text-fg">
              En cours <span className="text-fg-subtle">· {activeExpeditions.length}</span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-gold/25 bg-surface">
              {activeExpeditions.map((exp) => {
                const expZone = ZONES.find((z) => z.id === exp.zoneId);
                return (
                  <li key={exp.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-fg">
                      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-gold" aria-hidden />
                      <span className="min-w-0">
                        {expZone?.name ?? exp.zoneId}
                        {exp.difficulty && exp.difficulty !== "normal" ? ` (${getDifficulty(exp.difficulty).name})` : ""}
                        <span className="text-fg-subtle"> — {exp.heroIds.length} héros</span>
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => abandon(exp.id)} disabled={abandoningId === exp.id}>
                        {abandoningId === exp.id ? "..." : "Abandonner"}
                      </Button>
                      <Link href={`/expeditions/jouer/${exp.id}`} transitionTypes={["nav-forward"]} className={buttonClasses("primary", "sm")}>
                        Reprendre
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {ZONES.map((z, i) => {
            const unlocked = isZoneUnlocked(z, records);
            const record = records?.[z.id];
            const required = z.unlockRequires ? ZONES.find((r) => r.id === z.unlockRequires) : undefined;
            const elements = zoneElements(z);
            const selected = selectedZone === z.id;
            return (
              <div key={z.id} className="animate-rise" style={{ "--delay": `${Math.min(i, 6) * 40}ms` } as React.CSSProperties}>
                <Card accent={selected ? "gold" : "default"} interactive={unlocked && !selected} className={`h-full p-0 ${selected ? "bg-surface-2" : ""}`}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    className={`block h-full w-full rounded-xl p-5 text-left disabled:cursor-not-allowed ${focusRing}`}
                    disabled={!unlocked}
                    onClick={() => selectZone(z)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className={`flex items-center gap-1.5 font-semibold ${unlocked ? "text-fg" : "text-fg-subtle"}`}>
                        {!unlocked && <LockGlyph className="h-4 w-4 text-fg-faint" />}
                        <span className="tabular-nums text-fg-subtle">{z.tier}.</span> {z.name}
                      </p>
                      <StarRow count={record?.bestStars ?? 0} />
                    </div>
                    <p className={`mt-1 text-sm leading-relaxed ${unlocked ? "text-fg-muted" : "text-fg-faint"}`}>{z.description}</p>
                    {unlocked ? (
                      <div className="mt-3 space-y-1 text-xs text-fg-subtle">
                        <p className="tabular-nums">
                          <span className="text-fg-muted">{z.durationSec}s</span> · {z.heroSlots} héros max · Puissance conseillée{" "}
                          <span className="text-fg-muted">{z.recommendedPower}</span>
                        </p>
                        <p>
                          Boss : <span className="text-fg-muted">{z.boss.name}</span> · Butin : or,{" "}
                          {Object.keys(z.loot.resourceDrops).map((k) => RESOURCE_LABEL[k as ResourceKind]).join(", ")}, objets
                        </p>
                        {(elements.attacks.length > 0 || elements.weaknesses.length > 0) && (
                          <p>
                            {elements.attacks.length > 0 && <>Attaques : {elements.attacks.map((e) => ELEMENT_ICON[e]).join(" ")} · </>}
                            {elements.weaknesses.length > 0 && <>Faiblesses : {elements.weaknesses.map((e) => ELEMENT_ICON[e]).join(" ")}</>}
                          </p>
                        )}
                        {record && <p className="tabular-nums">Victoires : {record.clears}</p>}
                        <p className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                          {DIFFICULTIES.map((d) => {
                            const stars = records?.[recordKey(z.id, d.id)]?.bestStars ?? 0;
                            if (!isDifficultyUnlocked(z.id, d.id, records)) return null;
                            return (
                              <span key={d.id} title={d.name} className="inline-flex items-center gap-1">
                                <span className="text-[10px]">{d.icon}</span> <StarRow count={stars} />
                              </span>
                            );
                          })}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-faint">
                        <LockGlyph />
                        Terminez « {required?.name} » pour débloquer cette zone.
                      </p>
                    )}
                  </button>
                </Card>
              </div>
            );
          })}
        </div>

        {zone && (
          <Card accent="gold" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-fg">
                Équipe pour {zone.name}{" "}
                <span className="font-normal tabular-nums text-fg-subtle">
                  ({team.length}/{zone.heroSlots})
                </span>
              </h2>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={autoTeam} disabled={idleHeroes.length === 0}>
                  Équipe auto (les plus forts)
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedHeroes([])} disabled={team.length === 0}>
                  Vider
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => {
                  const open = isDifficultyUnlocked(zone.id, d.id, records);
                  return (
                    <Chip key={d.id} selected={difficulty === d.id} disabled={!open} onClick={() => setDifficulty(d.id)}>
                      <span title={open ? undefined : "Battez le boss (2★) dans la difficulté précédente"} className="inline-flex items-center gap-1.5">
                        {open ? <span className="text-[10px]">{d.icon}</span> : <LockGlyph />} {d.name}
                      </span>
                    </Chip>
                  );
                })}
              </div>
              {difficulty !== "normal" && (
                <p className="text-xs leading-relaxed text-fg-subtle">
                  {getDifficulty(difficulty).name} : monstres ×{getDifficulty(difficulty).statMul}, or/ressources ×{getDifficulty(difficulty).lootMul}, objets de
                  palier +{getDifficulty(difficulty).itemTierBonus}
                  {getDifficulty(difficulty).crystalBonus > 0 ? `, +${getDifficulty(difficulty).crystalBonus} 💎 par victoire` : ""}. Les chances de butin et
                  de rareté ne changent pas.
                </p>
              )}
            </div>

            {team.length > 0 && (
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm tabular-nums">
                <span className="text-fg-subtle">Puissance</span>
                <span className="text-lg font-semibold text-fg">{teamPower}</span>
                <span className="text-fg-subtle">/ {zone.recommendedPower} conseillée</span>
                <span className={`font-medium ${powerVerdict(teamPower, zone).className}`}>· {powerVerdict(teamPower, zone).label}</span>
              </p>
            )}

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {idleHeroes.map((hero) => {
                const classDef = tryGetClass(hero.classId);
                const spellIcons = (hero.equippedSpellIds ?? [])
                  .map((id) => tryGetSpell(id))
                  .filter(Boolean)
                  .map((s) => ARENA_SPELL_TAGS[s!.arenaAbilityTag].icon)
                  .join(" ");
                return (
                  <Chip
                    key={hero.id}
                    fullWidth
                    selected={team.includes(hero.id)}
                    disabled={!team.includes(hero.id) && teamFull}
                    onClick={() => toggleHero(hero.id)}
                    className="py-2"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        {team.includes(hero.id) && (
                          <span className="mr-1 tabular-nums text-gold">{team[0] === hero.id ? "👑" : `${team.indexOf(hero.id) + 1}.`}</span>
                        )}
                        <span className="text-fg">{hero.name}</span>{" "}
                        <span className="text-xs text-fg-subtle">
                          Nv.{hero.level} · {classDef?.name ?? "Sans classe"}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-fg-muted">💪 {powerByHero.get(hero.id)}</span>
                    </span>
                    {spellIcons && <span className="mt-0.5 block text-xs tracking-widest">{spellIcons}</span>}
                  </Chip>
                );
              })}
            </div>
            {idleHeroes.length === 0 && <p className="text-sm text-fg-subtle">Aucun héros disponible.</p>}
            {teamFull && (
              <p className="text-xs text-gold/80">Équipe complète : retirez un héros pour en choisir un autre.</p>
            )}
            <p className="text-xs leading-relaxed text-fg-subtle">
              Chaque héros combat sur le terrain selon son rôle (DPS : tirs, Tank : attire et frappe autour de lui, Soigneur : soigne) et lance
              automatiquement ses sorts équipés. Le premier héros sélectionné est le chef que vous dirigez.
            </p>
            <Button size="lg" onClick={start} disabled={starting || team.length === 0} className="w-full sm:w-auto">
              {starting ? "Départ..." : "Lancer l'expédition"}
            </Button>
          </Card>
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}
      </div>
    </PageTransition>
  );
}
