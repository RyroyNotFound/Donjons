"use client";

import Link from "next/link";
import { useState } from "react";
import { SPELLS } from "@/lib/game/content/spells";
import { MASTERIES } from "@/lib/game/content/masteries";
import { CLASSES } from "@/lib/game/content/classes";
import { ARENA_SPELL_TAGS, arenaSpellPower, describeArenaSpellValue } from "@/lib/game/arena/engine";
import { RAID_EFFECT_NAME } from "@/lib/game/engine/dungeonCombat";
import { ELEMENT_ICON, ELEMENT_LABEL, ELEMENTS } from "@/lib/game/engine/elements";
import { formatStatBonus, RAID_EFFECT_LABEL, describeRaidSpellValue } from "@/lib/game/statFormat";
import { componentRankMultiplier, MAX_COMPONENT_RANK, SPELL_SLOTS, MASTERY_SLOTS } from "@/lib/game/economy";
import { masteryImpact, type HeroContext } from "@/lib/game/heroInsights";
import { ImpactBadge } from "@/components/heroes/ImpactBadge";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { NavIcon } from "@/components/NavIcon";
import { inputClass, selectClass } from "@/components/Field";
import { focusRing } from "@/lib/ui/a11y";
import type { ArenaAbilityTag, Hero, HeroStats, RaidEffectTag, Role } from "@/types/game";

type Toggle = (kind: "spell" | "mastery", refId: string, equip: boolean) => void;

/** Scrollable divided list holding the spell / mastery rows. */
const LIST =
  "panel-scrollbar max-h-[36rem] divide-y divide-line overflow-y-auto rounded-lg border border-line bg-white/[0.02]";

/** Row of that list; equipped rows get a faint gold wash. */
function rowClass(equipped: boolean) {
  return `flex items-center justify-between gap-3 px-3 py-3 ${equipped ? "bg-gold/[0.05]" : ""}`;
}

/** Accent- and case-insensitive substring match on a name + description. */
function matchesSearch(query: string, ...texts: string[]): boolean {
  const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const q = norm(query.trim());
  return q === "" || texts.some((t) => norm(t).includes(q));
}

/** Search box always visible; the other filters fold behind a toggle showing how many are active. */
function FilterToggle({ open, active, onToggle }: { open: boolean; active: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] ${focusRing} ${
        active
          ? "border-gold/45 bg-gold/10 text-gold"
          : "border-line-strong text-fg-muted hover:bg-white/[0.04] hover:text-fg"
      }`}
    >
      Filtres{active ? <span className="tabular-nums"> ({active})</span> : ""}
      <NavIcon
        name="chevron-right"
        className={`h-3.5 w-3.5 transition-transform duration-200 ease-out ${open ? "-rotate-90" : "rotate-90"}`}
      />
    </button>
  );
}

function NoneOwned({ what }: { what: string }) {
  return (
    <p className="text-sm text-fg-subtle">
      Aucun{what === "maîtrise" ? "e" : ""} {what} obtenu{what === "maîtrise" ? "e" : ""} — voir l&apos;
      <Link
        href="/heros/inventaire"
        transitionTypes={["nav-forward"]}
        className="text-gold transition-colors duration-150 ease-out hover:text-gold-bright"
      >
        inventaire
      </Link>
      .
    </p>
  );
}

const RAID_TAGS = Object.keys(RAID_EFFECT_NAME) as RaidEffectTag[];
const ARENA_TAGS = Object.keys(ARENA_SPELL_TAGS) as ArenaAbilityTag[];

export function SpellList({
  hero,
  stats,
  role,
  ranks,
  busy,
  onToggle,
}: {
  hero: Hero;
  /** The hero's resolved stats: spell values are computed from its actual attack. */
  stats: HeroStats;
  role?: Role;
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = [element !== "all", classFilter !== "all", raidTag !== "all", arenaTag !== "all", equippedOnly].filter(Boolean).length;

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
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold text-fg">Sorts</h2>
        <p className="mt-1 text-sm leading-relaxed text-fg-muted">
          Emplacements : <span className="tabular-nums">{hero.equippedSpellIds.length}/{SPELL_SLOTS}</span> — utilisables sur
          n&apos;importe quel héros ; la classe assortie donne un bonus de puissance. Valeurs calculées avec l&apos;attaque de ce
          héros (<span className="tabular-nums">{Math.max(stats.atkPhys, stats.atkMag)}</span>), avant la défense ennemie. En
          donjon, seul le 1er sort équipé agit.
        </p>
      </div>
      {owned.length === 0 ? (
        <NoneOwned what="sort" />
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input className={inputClass} placeholder="Rechercher un sort…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <FilterToggle open={filtersOpen} active={activeFilters} onToggle={() => setFiltersOpen((v) => !v)} />
          </div>
          {filtersOpen && (
            <div className="grid grid-cols-2 gap-2">
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
                    {RAID_EFFECT_NAME[tag]}
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
          )}
          <p className="text-xs tabular-nums text-fg-subtle">
            {shown.length} / {owned.length} sort{owned.length > 1 ? "s" : ""}
          </p>
          <ul className={LIST}>
            {shown.map((spell) => {
              const equipped = hero.equippedSpellIds.includes(spell.id);
              const full = !equipped && hero.equippedSpellIds.length >= SPELL_SLOTS;
              const classMatch = !!spell.classId && spell.classId === hero.classId;
              const raidActive = hero.equippedSpellIds[0] === spell.id;
              const arena = ARENA_SPELL_TAGS[spell.arenaAbilityTag];
              const power = arenaSpellPower(spell, hero.classId, ranks[spell.id] ?? 1);
              return (
                <li key={spell.id} className={rowClass(equipped)}>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-fg">
                      {spell.name}{" "}
                      <span className="text-xs font-normal tabular-nums text-fg-subtle">
                        Rang {ranks[spell.id] ?? 1}/{MAX_COMPONENT_RANK}
                      </span>
                      {classMatch && <span className="ml-1.5 text-xs font-normal text-emerald-300">★ bonus de classe</span>}
                      {spell.element && (
                        <span className="ml-1.5 text-xs font-normal text-fg-muted">
                          {ELEMENT_ICON[spell.element]} {ELEMENT_LABEL[spell.element]}
                        </span>
                      )}
                    </p>
                    <p className="text-xs leading-relaxed text-fg-muted">{spell.description}</p>
                    <p
                      className={`text-xs ${equipped && !raidActive ? "text-fg-subtle" : "text-gold"}`}
                      title={RAID_EFFECT_LABEL[spell.raidEffectTag]}
                    >
                      Donjon · {RAID_EFFECT_NAME[spell.raidEffectTag]} : {describeRaidSpellValue(spell.raidEffectTag, classMatch, stats, role)}
                      {raidActive && <span className="ml-1 text-emerald-300">(actif)</span>}
                      {equipped && !raidActive && <span className="ml-1">(inactif : seul le 1er sort équipé agit en donjon)</span>}
                    </p>
                    <p className="text-xs text-sky-300" title={arena.description}>
                      Arène · {arena.icon} {arena.label} :{" "}
                      {describeArenaSpellValue(spell.arenaAbilityTag, Math.max(stats.atkPhys, stats.atkMag), stats.hp, power)}{" "}
                      <span className="text-fg-subtle">(toutes les {String(arena.cooldown).replace(".", ",")} s)</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={equipped ? "secondary" : "primary"}
                    onClick={() => onToggle("spell", spell.id, !equipped)}
                    disabled={busy || full}
                  >
                    {equipped ? "Retirer" : "Équiper"}
                  </Button>
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-3 py-3 text-sm text-fg-subtle">Aucun sort ne correspond aux filtres.</li>}
          </ul>
        </div>
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

/** A mastery's bonus at the given gacha rank, as resolveHeroStats applies it. */
function scaled(bonus: Partial<HeroStats>, rank: number): Partial<HeroStats> {
  const mul = componentRankMultiplier(rank);
  return Object.fromEntries(Object.entries(bonus).map(([k, v]) => [k, Math.round((v as number) * mul * 10) / 10])) as Partial<HeroStats>;
}

export function MasteryList({
  ctx,
  busy,
  onToggle,
}: {
  ctx: HeroContext;
  busy: boolean;
  onToggle: Toggle;
}) {
  const { hero, ranks } = ctx;
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [noMalus, setNoMalus] = useState(false);
  const [equippedOnly, setEquippedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = [group !== "all", noMalus, equippedOnly].filter(Boolean).length;

  const owned = MASTERIES.filter((m) => (ranks[m.id] ?? 0) > 0);
  const impacts = new Map(owned.map((m) => [m.id, masteryImpact(ctx, m.id)]));
  const groupStats = MASTERY_STAT_GROUPS.find((g) => g.id === group)?.stats;
  const shown = owned
    .filter((mastery) => {
      const values = Object.entries(mastery.statBonus) as [keyof HeroStats, number][];
      if (equippedOnly && !hero.equippedMasteryIds.includes(mastery.id)) return false;
      if (noMalus && values.some(([, v]) => v < 0)) return false;
      if (groupStats && !values.some(([stat, v]) => v > 0 && groupStats.includes(stat))) return false;
      return matchesSearch(search, mastery.name, mastery.description);
    })
    .sort(
      (a, b) =>
        Number(hero.equippedMasteryIds.includes(b.id)) - Number(hero.equippedMasteryIds.includes(a.id)) ||
        impacts.get(b.id)!.delta - impacts.get(a.id)!.delta,
    );

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold text-fg">Maîtrises</h2>
        <p className="mt-1 text-sm leading-relaxed text-fg-muted">
          Emplacements : <span className="tabular-nums">{hero.equippedMasteryIds.length}/{MASTERY_SLOTS}</span> — bonus de
          stats passifs. Triées par gain de puissance pour ce héros ; valeurs au rang possédé.
        </p>
      </div>
      {owned.length === 0 ? (
        <NoneOwned what="maîtrise" />
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input className={inputClass} placeholder="Rechercher une maîtrise…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <FilterToggle open={filtersOpen} active={activeFilters} onToggle={() => setFiltersOpen((v) => !v)} />
          </div>
          {filtersOpen && (
            <div className="grid grid-cols-2 gap-2">
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
          )}
          <p className="text-xs tabular-nums text-fg-subtle">
            {shown.length} / {owned.length} maîtrise{owned.length > 1 ? "s" : ""}
          </p>
          <ul className={LIST}>
            {shown.map((mastery) => {
              const equipped = hero.equippedMasteryIds.includes(mastery.id);
              const full = !equipped && hero.equippedMasteryIds.length >= MASTERY_SLOTS;
              return (
                <li key={mastery.id} className={rowClass(equipped)}>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-fg">
                      {mastery.name}{" "}
                      <span className="text-xs font-normal tabular-nums text-fg-subtle">
                        Rang {ranks[mastery.id] ?? 1}/{MAX_COMPONENT_RANK}
                      </span>
                    </p>
                    <p className="text-xs tabular-nums text-gold">{formatStatBonus(scaled(mastery.statBonus, ranks[mastery.id] ?? 1))}</p>
                    <p className="pb-1 text-xs leading-relaxed text-fg-subtle">{mastery.description}</p>
                    <ImpactBadge impact={impacts.get(mastery.id)!} kept={equipped} />
                  </div>
                  <Button
                    size="sm"
                    variant={equipped ? "secondary" : "primary"}
                    onClick={() => onToggle("mastery", mastery.id, !equipped)}
                    disabled={busy || full}
                  >
                    {equipped ? "Retirer" : "Équiper"}
                  </Button>
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-3 py-3 text-sm text-fg-subtle">Aucune maîtrise ne correspond aux filtres.</li>}
          </ul>
        </div>
      )}
    </Card>
  );
}
