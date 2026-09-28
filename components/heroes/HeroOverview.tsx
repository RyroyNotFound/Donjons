"use client";

import { CLASSES } from "@/lib/game/content/classes";
import { tryGetSpell } from "@/lib/game/content/spells";
import { getMastery } from "@/lib/game/content/masteries";
import { getTalentsForClass } from "@/lib/game/content/talents";
import { heroElement, heroPower } from "@/lib/game/engine/stats";
import { ELEMENT_ICON, ELEMENT_LABEL, ELEMENTS, RES_KEY } from "@/lib/game/engine/elements";
import { xpToNextLevel } from "@/lib/game/engine/xp";
import { levelCapForStar, MASTERY_SLOTS, MAX_STAR_RANK, rankUpCost, SPELL_SLOTS } from "@/lib/game/economy";
import { heroTodos, type HeroContext, type HeroTab } from "@/lib/game/heroInsights";
import { RAID_EFFECT_NAME } from "@/lib/game/engine/dungeonCombat";
import { RARITY_BADGE } from "@/lib/ui/rarity";
import { focusRing } from "@/lib/ui/a11y";
import { NavIcon } from "@/components/NavIcon";
import { ROLE_LABEL } from "@/lib/ui/role";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/ProgressBar";
import { selectClass } from "@/components/Field";
import type { ClassDefinition, HeroStats, ItemSlot, UserProfile } from "@/types/game";

const TODO_STYLE = {
  bad: { icon: "✗", color: "text-red-300" },
  warn: { icon: "⚠", color: "text-amber-300" },
  info: { icon: "ℹ", color: "text-fg-muted" },
} as const;

const SLOT_SHORT: Record<ItemSlot, string> = { weapon: "Arme", armor: "Armure", trinket: "Babiole" };

function Stat({ label, value, hint, strong }: { label: string; value: string | number; hint?: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-white/[0.025] px-3 py-2" title={hint}>
      <p className="truncate text-xs text-fg-subtle">{label}</p>
      <p className={`mt-0.5 truncate text-lg font-semibold tabular-nums ${strong ? "text-gold" : "text-fg"}`}>{value}</p>
    </div>
  );
}

/** A clickable row of the build summary: label + slots, jumping to the matching tab. */
function BuildRow({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold/60`}
    >
      <span className="w-20 shrink-0 pt-0.5 text-xs font-medium text-fg-subtle">{label}</span>
      <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">{children}</span>
      <NavIcon
        name="chevron-right"
        className="mt-0.5 h-4 w-4 shrink-0 text-fg-faint transition-[transform,color] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-gold"
      />
    </button>
  );
}

function Slot({ children, empty, className = "" }: { children: React.ReactNode; empty?: boolean; className?: string }) {
  return (
    <span className={`max-w-full truncate rounded-md border px-2 py-0.5 text-xs ${empty ? "border-dashed border-red-400/35 text-red-300/90" : className || "border-line bg-white/[0.03] text-fg"}`}>
      {children}
    </span>
  );
}

export function HeroOverview({
  ctx,
  stats,
  classDef,
  profile,
  busy,
  onAssignClass,
  onAscend,
  goTo,
}: {
  ctx: HeroContext;
  stats: HeroStats;
  classDef?: ClassDefinition;
  profile: UserProfile;
  busy: boolean;
  onAssignClass: (classId: string) => void;
  onAscend: () => void;
  goTo: (tab: HeroTab) => void;
}) {
  const { hero, items } = ctx;
  const magic = stats.atkMag > stats.atkPhys;
  const usedAtk = magic ? stats.atkMag : stats.atkPhys;
  const unusedAtk = magic ? stats.atkPhys : stats.atkMag;
  const element = heroElement(hero);
  const todos = heroTodos(ctx, profile);
  const star = hero.starRank ?? 1;
  const cap = levelCapForStar(star);
  const tree = classDef ? getTalentsForClass(classDef.id) : [];
  const cost = star < MAX_STAR_RANK ? rankUpCost(star) : null;
  const canAscend = !!classDef && !!cost && !busy && profile.rankTokens >= cost.rankTokens && profile.gold >= cost.gold;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold text-fg">Puissance</h2>
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-gold">{heroPower(stats)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat
              label={`Attaque ${magic ? "magique" : "physique"}`}
              value={usedAtk}
              strong
              hint="Un héros frappe toujours avec la plus haute de ses deux attaques"
            />
            <Stat label="PV" value={stats.hp} />
            <Stat label="Vitesse" value={stats.spd} />
            <Stat label="Déf. physique" value={stats.defPhys} hint="Réduit les coups physiques (la plupart des monstres)" />
            <Stat label="Déf. magique" value={stats.defMag} hint="Réduit les coups magiques" />
            <Stat label="Critique" value={`${stats.crit} % · +${stats.critDmg} %`} hint="Chance de critique · dégâts en plus" />
          </div>
          {unusedAtk > 0 && (
            <p className="text-xs text-fg-subtle">
              Attaque {magic ? "physique" : "magique"} : <span className="tabular-nums">{unusedAtk}</span> — inutilisée (seule la
              plus haute des deux compte).
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="mr-1 text-fg-muted">
              Élément :{" "}
              {element ? (
                <span className="text-fg">
                  {ELEMENT_ICON[element]} {ELEMENT_LABEL[element]}
                </span>
              ) : (
                <span className="text-fg-subtle">neutre</span>
              )}
            </span>
            {ELEMENTS.filter((el) => stats[RES_KEY[el]] !== 0).map((el) => (
              <span
                key={el}
                title={`Résistance ${ELEMENT_LABEL[el].toLowerCase()}`}
                className={`rounded-md border px-1.5 py-0.5 tabular-nums ${
                  stats[RES_KEY[el]] > 0
                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                    : "border-red-400/25 bg-red-400/10 text-red-300"
                }`}
              >
                {ELEMENT_ICON[el]} {stats[RES_KEY[el]]} %
              </span>
            ))}
            {stats.trapRes > 0 && (
              <span className="rounded-md border border-sky-400/25 bg-sky-400/10 px-1.5 py-0.5 tabular-nums text-sky-300">
                Pièges −{stats.trapRes} %
              </span>
            )}
          </div>
          <details className="group text-xs text-fg-subtle">
            <summary
              className={`flex cursor-pointer list-none items-center gap-1 rounded text-fg-muted [&::-webkit-details-marker]:hidden transition-colors duration-150 ease-out hover:text-fg ${focusRing}`}
            >
              <NavIcon
                name="chevron-right"
                className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-open:rotate-90"
              />
              Comment lire ces stats ?
            </summary>
            <p className="mt-2 leading-relaxed">
              La puissance résume le héros : son attaque utilisée, ses défenses, PV/10, sa vitesse, le gain moyen de ses critiques et
              un peu de ses résistances. Chaque choix des autres onglets affiche ce qu&apos;il y change (▲ / ▼). Un coup perd la moitié de
              la défense du même type chez la cible : mieux vaut tout miser sur un seul type d&apos;attaque. L&apos;élément vient du 1er
              sort élémentaire équipé ; il double presque les dégâts sur une faiblesse.
            </p>
          </details>
        </Card>

        <Card className="p-0">
          <h2 className="px-5 pb-2 pt-5 font-semibold text-fg">Build</h2>
          <div className="divide-y divide-line border-t border-line">
            <BuildRow label="Objets" onClick={() => goTo("equipement")}>
              {(["weapon", "armor", "trinket"] as ItemSlot[]).map((slot) => {
                const item = items.find((i) => i.id === hero.equipment[slot]);
                return item ? (
                  <Slot key={slot} className={RARITY_BADGE[item.rarity]}>
                    {item.name}
                    {item.enhanceLevel ? ` +${item.enhanceLevel}` : ""}
                  </Slot>
                ) : (
                  <Slot key={slot} empty>
                    {SLOT_SHORT[slot]} vide
                  </Slot>
                );
              })}
            </BuildRow>
            <BuildRow label="Sorts" onClick={() => goTo("sorts")}>
              {Array.from({ length: SPELL_SLOTS }, (_, i) => {
                const spell = tryGetSpell(hero.equippedSpellIds[i]);
                return spell ? (
                  <Slot key={i}>
                    {spell.name}
                    {i === 0 && <span className="ml-1 text-gold">· donjon : {RAID_EFFECT_NAME[spell.raidEffectTag]}</span>}
                  </Slot>
                ) : (
                  <Slot key={i} empty>
                    Vide
                  </Slot>
                );
              })}
            </BuildRow>
            <BuildRow label="Maîtrises" onClick={() => goTo("maitrises")}>
              {Array.from({ length: MASTERY_SLOTS }, (_, i) => {
                const id = hero.equippedMasteryIds[i];
                return id ? (
                  <Slot key={i}>{getMastery(id).name}</Slot>
                ) : (
                  <Slot key={i} empty>
                    Vide
                  </Slot>
                );
              })}
            </BuildRow>
            {classDef && (
              <BuildRow label="Talents" onClick={() => goTo("talents")}>
                <Slot>
                  <span className="tabular-nums">
                    {tree.filter((n) => (hero.talents[n.id] ?? 0) > 0).length}/{tree.length}
                  </span>{" "}
                  activés
                </Slot>
                {hero.talentPoints > 0 && (
                  <Slot className="border-gold/35 bg-gold/10 text-gold">
                    <span className="tabular-nums">{hero.talentPoints}</span> pts à dépenser
                  </Slot>
                )}
              </BuildRow>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card accent={todos.some((t) => t.tone === "bad") ? "danger" : todos.length ? "gold" : "success"} className="space-y-3">
          <h2 className="font-semibold text-fg">À améliorer</h2>
          {todos.length === 0 ? (
            <p className="text-sm text-emerald-300">Rien à signaler : ce héros tire le meilleur de ce que vous possédez.</p>
          ) : (
            <ul className="-mx-2 space-y-0.5">
              {todos.map((todo, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => goTo(todo.tab)}
                    className={`flex w-full gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 ease-out hover:bg-white/[0.04] ${focusRing} ${TODO_STYLE[todo.tone].color}`}
                  >
                    <span className="w-4 shrink-0 text-center" aria-hidden>
                      {TODO_STYLE[todo.tone].icon}
                    </span>
                    <span>{todo.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold text-fg">Classe</h2>
          {profile.unlockedClasses.length === 0 ? (
            <p className="text-sm text-fg-muted">Aucune classe obtenue pour l&apos;instant — tentez votre chance à l&apos;invocation.</p>
          ) : (
            <>
              <select
                disabled={busy || hero.status !== "idle"}
                value={hero.classId ?? ""}
                onChange={(e) => e.target.value && onAssignClass(e.target.value)}
                className={selectClass}
              >
                <option value="" disabled>
                  — Choisir une classe —
                </option>
                {CLASSES.filter((c) => profile.unlockedClasses.includes(c.id)).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({ROLE_LABEL[c.role]})
                  </option>
                ))}
              </select>
              {classDef && (
                <p className="text-xs leading-relaxed text-fg-subtle">
                  <span className="text-emerald-300">+</span> {classDef.strengths} · <span className="text-red-300">−</span>{" "}
                  {classDef.weaknesses}
                </p>
              )}
              {hero.status !== "idle" && <p className="text-xs text-gold">Rendez ce héros disponible pour changer de classe.</p>}
            </>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold text-fg">Progression</h2>
          <div className="space-y-2">
            <p className="flex justify-between text-xs text-fg-muted">
              <span>
                Niveau{" "}
                <span className="font-semibold tabular-nums text-fg">
                  {hero.level}/{cap}
                </span>
              </span>
              <span className="tabular-nums">
                XP {hero.xp}/{xpToNextLevel(hero.level)}
              </span>
            </p>
            <ProgressBar value={hero.xp} max={xpToNextLevel(hero.level)} label="Expérience" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
            <span className="tracking-wider">
              <span className="text-gold">{"★".repeat(star)}</span>
              <span className="text-fg-faint">{"☆".repeat(MAX_STAR_RANK - star)}</span>
            </span>
            {cost ? (
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-fg-muted">
                  {cost.rankTokens} jetons ({profile.rankTokens}) + {cost.gold} or
                </span>
                <Button size="sm" onClick={onAscend} disabled={!canAscend}>
                  Ascension
                </Button>
              </div>
            ) : (
              <span className="text-xs text-fg-muted">Rang maximum</span>
            )}
          </div>
          <p className="text-xs text-fg-subtle">Chaque étoile : +8 % de stats et +10 niveaux maximum.</p>
        </Card>
      </div>
    </div>
  );
}
