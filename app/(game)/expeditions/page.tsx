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
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button, buttonClasses } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { PageTransition } from "@/components/PageTransition";
import type { Difficulty, Element, ResourceKind, ZoneDefinition } from "@/types/game";

const RESOURCE_LABEL: Record<ResourceKind, string> = { wood: "Bois", ore: "Minerai", essence: "Essence" };

function StarRow({ count }: { count: number }) {
  return (
    <span aria-label={`${count} étoile(s) sur 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= count ? "text-amber-300" : "text-slate-700"}>
          ★
        </span>
      ))}
    </span>
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
  if (ratio >= 0.6) return { label: "Risqué", className: "text-orange-400" };
  return { label: "Très dangereux", className: "text-red-400" };
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
  const teamPower = selectedHeroes.reduce((sum, id) => sum + (powerByHero.get(id) ?? 0), 0);

  function selectZone(z: ZoneDefinition) {
    setSelectedZone(z.id);
    // Default to the hardest difficulty open on this zone.
    const open = DIFFICULTIES.filter((d) => isDifficultyUnlocked(z.id, d.id, records));
    setDifficulty(open[open.length - 1]?.id ?? "normal");
    // Pre-fill with the strongest available heroes — one click to launch.
    setSelectedHeroes(idleHeroes.slice(0, z.heroSlots).map((h) => h.id));
  }

  function toggleHero(heroId: string) {
    if (!zone) return;
    setSelectedHeroes((prev) => {
      if (prev.includes(heroId)) return prev.filter((id) => id !== heroId);
      if (prev.length >= zone.heroSlots) return prev;
      return [...prev, heroId];
    });
  }

  async function start() {
    if (!selectedZone || selectedHeroes.length === 0) return;
    setError(null);
    setStarting(true);
    try {
      const res = await callApi<{ expeditionId: string }>("/api/expeditions/start", {
        zoneId: selectedZone,
        heroIds: selectedHeroes,
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
      <div className="space-y-6">
        <PageHeader
          title="Expéditions"
          subtitle="Des sessions d'une minute : survivez aux vagues, battez le boss, rapportez le butin. La puissance de vos héros fait tout."
        />

        {activeExpeditions.length > 0 && (
          <Card accent="gold">
            <h2 className="font-display mb-3 font-semibold text-slate-50">En cours</h2>
            <ul className="space-y-2">
              {activeExpeditions.map((exp) => {
                const expZone = ZONES.find((z) => z.id === exp.zoneId);
                return (
                  <li
                    key={exp.id}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm"
                  >
                    <span className="text-slate-300">
                      {expZone?.name ?? exp.zoneId}
                      {exp.difficulty && exp.difficulty !== "normal" ? ` (${getDifficulty(exp.difficulty).name})` : ""} — {exp.heroIds.length} héros
                    </span>
                    <div className="flex items-center gap-2">
                      <Link href={`/expeditions/jouer/${exp.id}`} transitionTypes={["nav-forward"]} className={buttonClasses("primary", "sm")}>
                        Reprendre
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => abandon(exp.id)} disabled={abandoningId === exp.id}>
                        {abandoningId === exp.id ? "..." : "Abandonner"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {ZONES.map((z) => {
            const unlocked = isZoneUnlocked(z, records);
            const record = records?.[z.id];
            const required = z.unlockRequires ? ZONES.find((r) => r.id === z.unlockRequires) : undefined;
            const elements = zoneElements(z);
            return (
              <Card key={z.id} accent={selectedZone === z.id ? "gold" : "default"} interactive={unlocked}>
                <button className="w-full text-left disabled:cursor-not-allowed" disabled={!unlocked} onClick={() => selectZone(z)}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display font-semibold text-slate-50">
                      {unlocked ? "" : "🔒 "}
                      {z.tier}. {z.name}
                    </p>
                    <StarRow count={record?.bestStars ?? 0} />
                  </div>
                  <p className={`text-sm ${unlocked ? "text-slate-400" : "text-slate-600"}`}>{z.description}</p>
                  {unlocked ? (
                    <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                      <p>
                        ⏱️ {z.durationSec}s · 👥 {z.heroSlots} héros max · 💪 Puissance conseillée {z.recommendedPower}
                      </p>
                      <p>
                        👹 Boss : {z.boss.name} · Butin : or, {Object.keys(z.loot.resourceDrops).map((k) => RESOURCE_LABEL[k as ResourceKind]).join(", ")}, objets
                      </p>
                      {(elements.attacks.length > 0 || elements.weaknesses.length > 0) && (
                        <p>
                          {elements.attacks.length > 0 && <>Attaques : {elements.attacks.map((e) => ELEMENT_ICON[e]).join(" ")} · </>}
                          {elements.weaknesses.length > 0 && <>Faiblesses : {elements.weaknesses.map((e) => ELEMENT_ICON[e]).join(" ")}</>}
                        </p>
                      )}
                      {record && <p>Victoires : {record.clears}</p>}
                      <p className="flex flex-wrap gap-x-3">
                        {DIFFICULTIES.map((d) => {
                          const stars = records?.[recordKey(z.id, d.id)]?.bestStars ?? 0;
                          if (!isDifficultyUnlocked(z.id, d.id, records)) return null;
                          return (
                            <span key={d.id} title={d.name}>
                              {d.icon} <StarRow count={stars} />
                            </span>
                          );
                        })}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-600">Terminez « {required?.name} » pour débloquer cette zone.</p>
                  )}
                </button>
              </Card>
            );
          })}
        </div>

        {zone && (
          <Card>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display font-semibold text-slate-50">
                Équipe pour {zone.name} ({selectedHeroes.length}/{zone.heroSlots})
              </h2>
              <div className="flex w-full flex-wrap gap-2">
                {DIFFICULTIES.map((d) => {
                  const open = isDifficultyUnlocked(zone.id, d.id, records);
                  return (
                    <Chip key={d.id} selected={difficulty === d.id} disabled={!open} onClick={() => setDifficulty(d.id)}>
                      <span title={open ? undefined : "Battez le boss (2★) dans la difficulté précédente"}>
                        {open ? d.icon : "🔒"} {d.name}
                      </span>
                    </Chip>
                  );
                })}
              </div>
              {difficulty !== "normal" && (
                <p className="w-full text-xs text-slate-500">
                  {getDifficulty(difficulty).name} : monstres ×{getDifficulty(difficulty).statMul}, or/ressources ×{getDifficulty(difficulty).lootMul}, objets de
                  palier +{getDifficulty(difficulty).itemTierBonus}
                  {getDifficulty(difficulty).crystalBonus > 0 ? `, +${getDifficulty(difficulty).crystalBonus} 💎 par victoire` : ""}. Les chances de butin et
                  de rareté ne changent pas.
                </p>
              )}
              {selectedHeroes.length > 0 && (
                <p className="text-sm">
                  <span className="text-slate-400">Puissance : </span>
                  <span className="font-semibold text-slate-100">{teamPower}</span>
                  <span className="text-slate-500"> / {zone.recommendedPower} conseillée · </span>
                  <span className={powerVerdict(teamPower, zone).className}>{powerVerdict(teamPower, zone).label}</span>
                </p>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {idleHeroes.map((hero) => {
                const classDef = tryGetClass(hero.classId);
                const spellIcons = (hero.equippedSpellIds ?? [])
                  .map((id) => tryGetSpell(id))
                  .filter(Boolean)
                  .map((s) => ARENA_SPELL_TAGS[s!.arenaAbilityTag].icon)
                  .join(" ");
                return (
                  <Chip key={hero.id} fullWidth selected={selectedHeroes.includes(hero.id)} onClick={() => toggleHero(hero.id)}>
                    <span className="flex items-center justify-between gap-2">
                      <span>
                        {hero.name} <span className="text-xs text-slate-500">Nv.{hero.level} · {classDef?.name ?? "Sans classe"}</span>
                      </span>
                      <span className="text-xs text-amber-300">💪 {powerByHero.get(hero.id)}</span>
                    </span>
                    {spellIcons && <span className="block text-xs tracking-widest">{spellIcons}</span>}
                  </Chip>
                );
              })}
            </div>
            {idleHeroes.length === 0 && <p className="mt-2 text-sm text-slate-500">Aucun héros disponible.</p>}
            <p className="mt-3 text-xs text-slate-500">
              Chaque héros combat sur le terrain selon son rôle (DPS : tirs, Tank : attire et frappe autour de lui, Soigneur : soigne) et lance
              automatiquement ses sorts équipés. Le premier héros sélectionné est le chef que vous dirigez.
            </p>
            <Button onClick={start} disabled={starting || selectedHeroes.length === 0} className="mt-4">
              {starting ? "Départ..." : "Lancer l'expédition"}
            </Button>
          </Card>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </PageTransition>
  );
}
