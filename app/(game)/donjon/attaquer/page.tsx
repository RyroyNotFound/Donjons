"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { equippedItemsOf, getHeroRole, heroElement, primaryRaidEffect, resolveHeroStats } from "@/lib/game/engine/stats";
import { ELEMENT_ICON, ELEMENT_LABEL, MAX_TRAP_RESISTANCE, RES_KEY } from "@/lib/game/engine/elements";
import { tryGetClass } from "@/lib/game/content/classes";
import { MAX_TREASURE_ROOMS, RAID_PARTY_MAX } from "@/lib/game/content/dungeon";
import { conquestBountyPreview, treasureRoomBonus } from "@/lib/game/engine/loot";
import { getBotDungeon } from "@/lib/game/content/botDungeons";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { Badge } from "@/components/Badge";
import { Chip } from "@/components/Chip";
import { PageTransition } from "@/components/PageTransition";
import { EmptyState } from "@/components/EmptyState";
import type { DungeonTarget } from "@/app/api/dungeon/targets/route";
import type { Element, RaidView } from "@/types/game";

/** Same magnitudes as dungeonCombat.ts RAID_MAGNITUDE.disarm — shown to help the player prepare. */
const DISARM_PREVIEW = { base: 35, bonus: 50 };

function IntelLine({ target }: { target: DungeonTarget }) {
  const i = target.intel;
  const threats = [...new Set([...i.trapElements, ...i.monsterElements])];
  const bounty = conquestBountyPreview(i.defenseLevel, target.isBot);
  return (
    <div className="mt-1 space-y-0.5 text-xs text-slate-400">
      <p>
        🛡️ Niveau de défense {i.defenseLevel} · {i.roomCount} salle(s) · {i.treasureRooms} trésor(s)
      </p>
      <p className="text-amber-200/80">
        💰 Chaque salle au trésor ({i.treasureRooms}) :{" "}
        {target.isBot
          ? `${Math.round(getBotDungeon(target.defenderId).loot.gold / MAX_TREASURE_ROOMS)} or + ressources`
          : `¼ de ce qui peut lui être volé + ${treasureRoomBonus(i.defenseLevel).gold} or et ${treasureRoomBonus(i.defenseLevel).resources.wood} de chaque ressource`}
      </p>
      <p className="text-amber-200/80">
        🏆 Prime de conquête : objet palier {bounty.tier}, {bounty.forgeShards} éclats
        {bounty.gold > 0 ? `, ${bounty.gold} or` : ""}
      </p>
      <p>
        ⚠️ {i.traps} piège(s) en {i.trapRooms} salle(s) · 👹 {i.monsters} monstre(s){i.hasBoss ? " dont un boss" : ""}
        {i.garrison > 0 ? ` · 🧍 garnison ×${i.garrison}` : ""}
      </p>
      {threats.length > 0 && (
        <p>
          Dégâts : {threats.map((e) => `${ELEMENT_ICON[e]} ${ELEMENT_LABEL[e]}`).join(", ")}
        </p>
      )}
      {i.monsterWeaknesses.length > 0 && (
        <p className="text-emerald-300/80">
          Faiblesses des monstres : {i.monsterWeaknesses.map((e) => `${ELEMENT_ICON[e]} ${ELEMENT_LABEL[e]}`).join(", ")}
        </p>
      )}
    </div>
  );
}

export default function AttaquerPage() {
  const { heroes, items, profile, dungeon } = useGameData();
  const router = useRouter();
  const [targets, setTargets] = useState<DungeonTarget[]>([]);
  const [myLevel, setMyLevel] = useState(1);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedHeroes, setSelectedHeroes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [starting, setStarting] = useState(false);
  const [checkingActive, setCheckingActive] = useState(true);

  const idleHeroes = heroes.filter((h) => h.classId && h.status === "idle");
  const target = targets.find((t) => t.defenderId === selectedTarget);

  // Only sets state in callbacks, so the initial load can run from an effect.
  function fetchTargets() {
    callApi<{ targets: DungeonTarget[]; myLevel: number }>("/api/dungeon/targets", undefined, "GET")
      .then((res) => {
        setTargets(res.targets);
        setMyLevel(res.myLevel);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingTargets(false));
  }

  function refreshTargets() {
    setLoadingTargets(true);
    fetchTargets();
  }

  useEffect(() => {
    fetchTargets();
    callApi<{ view: RaidView | null }>("/api/dungeon/raid/active", undefined, "GET")
      .then((res) => {
        if (res.view)
          router.replace(`/donjon/attaquer/raid/${res.view.raidId}`, {
            transitionTypes: ["nav-forward"],
          });
      })
      .catch(() => {})
      .finally(() => setCheckingActive(false));
  }, [router]);

  const heroInfo = useMemo(() => {
    const map = new Map<string, { stats: ReturnType<typeof resolveHeroStats>; tag?: string; bonus: boolean; element?: Element; healer: boolean }>();
    for (const hero of heroes) {
      const stats = resolveHeroStats(hero, equippedItemsOf(hero, items), profile?.componentRanks);
      const effect = primaryRaidEffect(hero);
      map.set(hero.id, { stats, tag: effect?.tag, bonus: !!effect?.bonus, element: heroElement(hero), healer: getHeroRole(hero) === "HEAL" });
    }
    return map;
  }, [heroes, items, profile?.componentRanks]);

  // What the chosen team brings against the chosen dungeon's threats.
  const prep = useMemo(() => {
    const team = selectedHeroes.map((id) => heroInfo.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof heroInfo.get>>[];
    if (team.length === 0 || !target) return null;
    const avgTrapRes = Math.round(team.reduce((s, h) => s + Math.min(MAX_TRAP_RESISTANCE, Math.max(0, h.stats.trapRes)), 0) / team.length);
    const disarmers = team.filter((h) => h.tag === "disarm");
    const disarm = disarmers.length === 0 ? 0 : Math.max(...disarmers.map((h) => (h.bonus ? DISARM_PREVIEW.bonus : DISARM_PREVIEW.base)));
    const threats = [...new Set([...target.intel.trapElements, ...target.intel.monsterElements])];
    return {
      avgTrapRes,
      disarm,
      trapCut: Math.round(100 - (100 - avgTrapRes) * (1 - disarm / 100)),
      scout: team.some((h) => h.tag === "scout"),
      healers: team.filter((h) => h.healer).length,
      exploiting: team.filter((h) => h.element && target.intel.monsterWeaknesses.includes(h.element)).length,
      threats: threats.map((e) => ({ e, res: Math.round(team.reduce((s, h) => s + (h.stats[RES_KEY[e]] as number), 0) / team.length) })),
    };
  }, [selectedHeroes, heroInfo, target]);

  function toggleHero(heroId: string) {
    setSelectedHeroes((prev) =>
      prev.includes(heroId)
        ? prev.filter((id) => id !== heroId)
        : prev.length >= RAID_PARTY_MAX
          ? prev
          : [...prev, heroId],
    );
  }

  async function startRaid() {
    // A selected hero may have left since (expedition started from another tab).
    const heroIds = selectedHeroes.filter((id) => idleHeroes.some((h) => h.id === id));
    if (!selectedTarget || heroIds.length === 0) return;
    setError(null);
    setStarting(true);
    try {
      const res = await callApi<{ raidId: string }>("/api/dungeon/raid/start", {
        defenderId: selectedTarget,
        heroIds,
      });
      router.push(`/donjon/attaquer/raid/${res.raidId}`, { transitionTypes: ["nav-forward"] });
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  }

  if (checkingActive)
    return (
      <PageTransition>
        <Spinner label="Vérification d'un raid en cours..." />
      </PageTransition>
    );

  // Attacking requires having built one's own dungeon (same rule as /api/dungeon/raid/start). A missing
  // doc may just not have arrived yet: the server check covers it.
  if (dungeon && dungeon.treasureRoomCount < 1)
    return (
      <PageTransition>
        <EmptyState
          message="Pour attaquer un donjon, construisez d'abord le vôtre : placez au moins une salle au trésor et enregistrez-le."
          backHref="/donjon"
          backLabel="Construire mon donjon"
        />
      </PageTransition>
    );

  return (
    <PageTransition>
    <div className="space-y-6">
      <PageHeader
        title="Attaquer un donjon"
        subtitle="Lisez le rapport d'éclaireur, préparez une équipe adaptée, puis pillez."
        action={
          <Button size="sm" variant="secondary" onClick={refreshTargets} disabled={loadingTargets}>
            🔄 Nouvelles cibles
          </Button>
        }
      />
      <p className="-mt-4 text-sm text-slate-400">
        Niveau d&apos;équipe : <span className="font-semibold text-slate-200">{myLevel}</span> — les donjons proposés sont proches de ce
        niveau. Plus un donjon est fort, plus sa conquête rapporte (cristaux et butin).
      </p>

      {loadingTargets && <Spinner label="Recherche de cibles..." />}
      {!loadingTargets && targets.length === 0 && (
        <p className="text-slate-400">Aucune cible disponible pour le moment.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {targets.map((t) => (
          <Card
            key={t.defenderId}
            accent={selectedTarget === t.defenderId ? "gold" : t.isBot ? "danger" : "default"}
            interactive
          >
            <button className="w-full text-left" onClick={() => setSelectedTarget(t.defenderId)}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-display font-semibold text-slate-50">{t.displayName}</p>
                {t.isBot && <Badge tone="danger">Repaire</Badge>}
                {t.conqueredToday && <Badge tone="neutral">Conquis aujourd&apos;hui</Badge>}
              </div>
              <IntelLine target={t} />
              {t.hint && <p className="mt-1 text-xs italic text-amber-300/80">💡 {t.hint}</p>}
            </button>
          </Card>
        ))}
      </div>

      {target && (
        <Card textured accent="danger">
          <h2 className="font-display mb-1 font-semibold text-slate-50">Préparer l&apos;équipe contre {target.displayName}</h2>
          <p className="mb-3 text-xs text-slate-500">
            Héros choisis : {selectedHeroes.length}/{RAID_PARTY_MAX}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {idleHeroes.map((hero) => {
              const info = heroInfo.get(hero.id)!;
              return (
                <Chip
                  key={hero.id}
                  fullWidth
                  selected={selectedHeroes.includes(hero.id)}
                  disabled={!selectedHeroes.includes(hero.id) && selectedHeroes.length >= RAID_PARTY_MAX}
                  onClick={() => toggleHero(hero.id)}
                >
                  <span className="flex flex-wrap items-center justify-between gap-x-2">
                    <span>
                      {hero.name} <span className="text-xs text-slate-500">Nv.{hero.level} · {tryGetClass(hero.classId)?.name}</span>
                    </span>
                    <span className="text-xs text-slate-400">
                      {info.element ? ELEMENT_ICON[info.element] : ""}
                      {info.tag === "disarm" && " 🔧 Désamorçage"}
                      {info.tag === "scout" && " 🔭 Éclaireur"}
                      {info.healer && " ✚ Soins de marche"}
                      {info.stats.trapRes > 0 && ` · ⚠️ ${info.stats.trapRes}%`}
                    </span>
                  </span>
                </Chip>
              );
            })}
          </div>
          {idleHeroes.length === 0 && <p className="mt-2 text-sm text-slate-500">Aucun héros disponible.</p>}

          {prep && (
            <div className="mt-4 grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-300 sm:grid-cols-2">
              <p>
                ⚠️ Dégâts des pièges réduits de <span className="font-semibold text-slate-100">{prep.trapCut} %</span>
                <span className="text-slate-500">
                  {" "}
                  (rés. moyenne {prep.avgTrapRes} %{prep.disarm > 0 ? `, Désamorçage ${prep.disarm} %` : ", aucun Désamorçage"})
                </span>
                {target.intel.traps > 0 && prep.trapCut < 30 && <span className="text-red-400"> — risqué face à {target.intel.traps} pièges</span>}
              </p>
              <p>
                ✚ {prep.healers} soigneur(s) : {prep.healers > 0 ? "l'équipe récupère entre les salles" : <span className="text-red-400">aucune récupération entre les salles</span>}
              </p>
              <p>🔭 Éclaireur : {prep.scout ? "oui, les salles voisines seront révélées" : "non, exploration à l'aveugle"}</p>
              {target.intel.monsterWeaknesses.length > 0 && (
                <p>
                  🎯 {prep.exploiting}/{selectedHeroes.length} héros frappent une faiblesse des monstres
                  <span className="text-slate-500"> (affinité = premier sort élémentaire équipé)</span>
                </p>
              )}
              {prep.threats.length > 0 && (
                <p>
                  Résistances de l&apos;équipe :{" "}
                  {prep.threats.map(({ e, res }) => (
                    <span key={e} className={res >= 20 ? "text-emerald-300" : res < 0 ? "text-red-400" : "text-slate-300"}>
                      {ELEMENT_ICON[e]} {res}%{" "}
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Astuce : le premier sort équipé d&apos;un héros définit son effet de raid. Un sort de Désamorçage ou d&apos;Éclaireur remplace
            son effet de combat par un atout pour toute l&apos;équipe. Les maîtrises « Pas feutré », « Démineur »… et les affixes « du Démineur »
            réduisent les dégâts de pièges.
          </p>
          <Button variant="danger" onClick={startRaid} disabled={starting || selectedHeroes.length === 0} className="mt-4">
            {starting ? "Préparation..." : "Lancer l'attaque"}
          </Button>
        </Card>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
    </PageTransition>
  );
}
