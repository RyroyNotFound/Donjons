"use client";

import Link from "next/link";
import { useState } from "react";
import { SPELLS } from "@/lib/game/content/spells";
import { MASTERIES } from "@/lib/game/content/masteries";
import { CLASSES } from "@/lib/game/content/classes";
import { ARENA_SPELL_TAGS } from "@/lib/game/arena/engine";
import { ELEMENT_ICON, ELEMENT_LABEL, ELEMENTS } from "@/lib/game/engine/elements";
import { formatStatBonus, RAID_EFFECT_LABEL, ARENA_EFFECT_LABEL } from "@/lib/game/statFormat";
import { MAX_COMPONENT_RANK, SPELL_SLOTS, MASTERY_SLOTS } from "@/lib/game/economy";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Panel } from "@/components/Panel";
import { inputClass, selectClass } from "@/components/Field";
import type { ArenaAbilityTag, Hero, HeroStats, RaidEffectTag } from "@/types/game";

type Toggle = (kind: "spell" | "mastery", refId: string, equip: boolean) => void;

/** Accent- and case-insensitive substring match on a name + description. */
function matchesSearch(query: string, ...texts: string[]): boolean {
  const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const q = norm(query.trim());
  return q === "" || texts.some((t) => norm(t).includes(q));
}

function NoneOwned({ what }: { what: string }) {
  return (
    <p className="text-sm text-slate-500">
      Aucun{what === "maîtrise" ? "e" : ""} {what} obtenu{what === "maîtrise" ? "e" : ""} — voir l&apos;
      <Link href="/heros/inventaire" transitionTypes={["nav-forward"]} className="text-amber-400 underline">
        inventaire
      </Link>
      .
    </p>
  );
}

const RAID_EFFECT_SHORT: Record<RaidEffectTag, string> = {
  cleave: "Éclaboussure",
  execute: "Exécution",
  pierce: "Perce-défense",
  stun: "Étourdissement",
  lifesteal: "Vol de vie",
  poison: "Poison",
  shield: "Bouclier",
  heal: "Soin renforcé",
  disarm: "Désamorçage",
  scout: "Éclaireur",
};
const RAID_TAGS = Object.keys(RAID_EFFECT_SHORT) as RaidEffectTag[];
const ARENA_TAGS = Object.keys(ARENA_SPELL_TAGS) as ArenaAbilityTag[];

export function SpellList({
  hero,
  ranks,
  busy,
  onToggle,
}: {
  hero: Hero;
  ranks: Record<string, number>;
  busy: boolean;
  onToggle: Toggle;
}) {
  const [search, setSearch] = useState("");
  const [element, setElement] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [raidTag, setRaidTag] = useState("all");
  const [arenaTag, setArenaTag] = useState("all");
  const [equippedOnly, setEquippedOnly] = useState(false);

  const owned = SPELLS.filter((spell) => (ranks[spell.id] ?? 0) > 0);
  const shown = owned
    .filter((spell) => {
      const equipped = hero.equippedSpellIds.includes(spell.id);
      if (equippedOnly && !equipped) return false;
      if (element === "none" ? !!spell.element : element !== "all" && spell.element !== element) return false;
      if (classFilter === "mine" ? spell.classId !== hero.classId : classFilter !== "all" && spell.classId !== classFilter)
        return false;
      if (raidTag !== "all" && spell.raidEffectTag !== raidTag) return false;
      if (arenaTag !== "all" && spell.arenaAbilityTag !== arenaTag) return false;
      return matchesSearch(search, spell.name, spell.description);
    })
    .sort((a, b) => Number(hero.equippedSpellIds.includes(b.id)) - Number(hero.equippedSpellIds.includes(a.id)));

  return (
    <Card>
      <h2 className="font-display mb-1 font-semibold text-slate-50">Sorts</h2>
      <p className="mb-3 text-sm text-slate-400">
        Emplacements : {hero.equippedSpellIds.length}/{SPELL_SLOTS} — utilisables sur n&apos;importe quel héros ; la
        classe assortie donne un bonus de puissance.
      </p>
      {owned.length === 0 ? (
        <NoneOwned what="sort" />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <input
              className={`${inputClass} col-span-2`}
              placeholder="Rechercher un sort…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className={selectClass} value={element} onChange={(e) => setElement(e.target.value)} aria-label="Élément">
              <option value="all">Tous les éléments</option>
              {ELEMENTS.map((el) => (
                <option key={el} value={el}>
                  {ELEMENT_ICON[el]} {ELEMENT_LABEL[el]}
                </option>
              ))}
              <option value="none">Neutre</option>
            </select>
            <select className={selectClass} value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Classe">
              <option value="all">Toutes les classes</option>
              {hero.classId && <option value="mine">★ Bonus de classe</option>}
              {CLASSES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select className={selectClass} value={raidTag} onChange={(e) => setRaidTag(e.target.value)} aria-label="Effet en donjon">
              <option value="all">Tout effet en donjon</option>
              {RAID_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {RAID_EFFECT_SHORT[tag]}
                </option>
              ))}
            </select>
            <select className={selectClass} value={arenaTag} onChange={(e) => setArenaTag(e.target.value)} aria-label="Effet en expédition">
              <option value="all">Tout effet en expédition</option>
              {ARENA_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {ARENA_SPELL_TAGS[tag].icon} {ARENA_SPELL_TAGS[tag].label}
                </option>
              ))}
            </select>
            <Chip selected={equippedOnly} onClick={() => setEquippedOnly((v) => !v)} className="col-span-2">
              Équipés uniquement
            </Chip>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            {shown.length} / {owned.length} sort{owned.length > 1 ? "s" : ""}
          </p>
          <div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
            {shown.map((spell) => {
              const equipped = hero.equippedSpellIds.includes(spell.id);
              const full = !equipped && hero.equippedSpellIds.length >= SPELL_SLOTS;
              const classMatch = !!spell.classId && spell.classId === hero.classId;
              return (
                <Panel key={spell.id} tone={equipped ? "highlight" : "neutral"} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-100">
                      {spell.name}{" "}
                      <span className="text-xs text-slate-500">
                        Rang {ranks[spell.id] ?? 1}/{MAX_COMPONENT_RANK}
                      </span>
                      {classMatch && <span className="ml-1 text-xs text-emerald-400">★ bonus de classe</span>}
                      {spell.element && (
                        <span className="ml-1 text-xs text-slate-300">
                          {ELEMENT_ICON[spell.element]} {ELEMENT_LABEL[spell.element]}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">{spell.description}</p>
                    <p className="mt-0.5 text-xs text-amber-400">Donjon : {RAID_EFFECT_LABEL[spell.raidEffectTag]}</p>
                    <p className="text-xs text-sky-400">{ARENA_EFFECT_LABEL[spell.arenaAbilityTag]}</p>
                  </div>
                  <Button size="sm" onClick={() => onToggle("spell", spell.id, !equipped)} disabled={busy || full}>
                    {equipped ? "Retirer" : "Équiper"}
                  </Button>
                </Panel>
              );
            })}
            {shown.length === 0 && <p className="text-sm text-slate-500">Aucun sort ne correspond aux filtres.</p>}
          </div>
        </>
      )}
    </Card>
  );
}

/** Mastery filter buckets: each matches masteries that raise at least one of its stats. */
const MASTERY_STAT_GROUPS: { id: string; label: string; stats: (keyof HeroStats)[] }[] = [
  { id: "atkPhys", label: "Attaque physique", stats: ["atkPhys"] },
  { id: "atkMag", label: "Attaque magique", stats: ["atkMag"] },
  { id: "def", label: "Défense", stats: ["defPhys", "defMag"] },
  { id: "hp", label: "PV", stats: ["hp"] },
  { id: "spd", label: "Vitesse", stats: ["spd"] },
  { id: "crit", label: "Critique", stats: ["crit", "critDmg"] },
  { id: "res", label: "Résistances élémentaires", stats: ["resFeu", "resGlace", "resFoudre", "resSacre", "resOmbre"] },
  { id: "trapRes", label: "Résistance aux pièges", stats: ["trapRes"] },
];

export function MasteryList({
  hero,
  ranks,
  busy,
  onToggle,
}: {
  hero: Hero;
  ranks: Record<string, number>;
  busy: boolean;
  onToggle: Toggle;
}) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [noMalus, setNoMalus] = useState(false);
  const [equippedOnly, setEquippedOnly] = useState(false);

  const owned = MASTERIES.filter((m) => (ranks[m.id] ?? 0) > 0);
  const groupStats = MASTERY_STAT_GROUPS.find((g) => g.id === group)?.stats;
  const shown = owned
    .filter((mastery) => {
      const values = Object.entries(mastery.statBonus) as [keyof HeroStats, number][];
      if (equippedOnly && !hero.equippedMasteryIds.includes(mastery.id)) return false;
      if (noMalus && values.some(([, v]) => v < 0)) return false;
      if (groupStats && !values.some(([stat, v]) => v > 0 && groupStats.includes(stat))) return false;
      return matchesSearch(search, mastery.name, mastery.description);
    })
    .sort((a, b) => Number(hero.equippedMasteryIds.includes(b.id)) - Number(hero.equippedMasteryIds.includes(a.id)));

  return (
    <Card>
      <h2 className="font-display mb-1 font-semibold text-slate-50">Maîtrises</h2>
      <p className="mb-3 text-sm text-slate-400">
        Emplacements : {hero.equippedMasteryIds.length}/{MASTERY_SLOTS} — universelles, disponibles sans classe.
      </p>
      {owned.length === 0 ? (
        <NoneOwned what="maîtrise" />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <input
              className={`${inputClass} col-span-2`}
              placeholder="Rechercher une maîtrise…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className={`${selectClass} col-span-2`} value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Statistique">
              <option value="all">Toutes les statistiques</option>
              {MASTERY_STAT_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            <Chip selected={noMalus} onClick={() => setNoMalus((v) => !v)}>
              Sans malus
            </Chip>
            <Chip selected={equippedOnly} onClick={() => setEquippedOnly((v) => !v)}>
              Équipées uniquement
            </Chip>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            {shown.length} / {owned.length} maîtrise{owned.length > 1 ? "s" : ""}
          </p>
          <div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
            {shown.map((mastery) => {
              const equipped = hero.equippedMasteryIds.includes(mastery.id);
              const full = !equipped && hero.equippedMasteryIds.length >= MASTERY_SLOTS;
              return (
                <Panel key={mastery.id} tone={equipped ? "highlight" : "neutral"} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-100">
                      {mastery.name}{" "}
                      <span className="text-xs text-slate-500">
                        Rang {ranks[mastery.id] ?? 1}/{MAX_COMPONENT_RANK}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">{mastery.description}</p>
                    <p className="mt-0.5 text-xs text-amber-400">{formatStatBonus(mastery.statBonus)}</p>
                  </div>
                  <Button size="sm" onClick={() => onToggle("mastery", mastery.id, !equipped)} disabled={busy || full}>
                    {equipped ? "Retirer" : "Équiper"}
                  </Button>
                </Panel>
              );
            })}
            {shown.length === 0 && <p className="text-sm text-slate-500">Aucune maîtrise ne correspond aux filtres.</p>}
          </div>
        </>
      )}
    </Card>
  );
}
