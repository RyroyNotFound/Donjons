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
import { ROLE_LABEL } from "@/lib/ui/role";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/ProgressBar";
import { selectClass } from "@/components/Field";
import type { ClassDefinition, HeroStats, ItemSlot, UserProfile } from "@/types/game";

const TODO_STYLE = {
  bad: { icon: "✗", color: "text-red-300" },
  warn: { icon: "⚠", color: "text-amber-300" },
  info: { icon: "ℹ", color: "text-slate-300" },
} as const;

const SLOT_SHORT: Record<ItemSlot, string> = { weapon: "Arme", armor: "Armure", trinket: "Babiole" };

function Stat({ label, value, hint, strong }: { label: string; value: string | number; hint?: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-black/25 px-2 py-1.5" title={hint}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`tabular-nums ${strong ? "text-lg font-bold text-amber-200" : "text-sm font-semibold text-slate-100"}`}>{value}</p>
    </div>
  );
}

/** A clickable row of the build summary: label + slots, jumping to the matching tab. */
function BuildRow({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5">
      <span className="w-20 shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">{children}</span>
      <span className="pt-0.5 text-xs text-slate-500">›</span>
    </button>
  );
}

function Slot({ children, empty, className = "" }: { children: React.ReactNode; empty?: boolean; className?: string }) {
  return (
    <span className={`max-w-full truncate rounded border px-2 py-0.5 text-xs ${empty ? "border-dashed border-red-500/40 text-red-300/80" : className || "border-white/10 text-slate-200"}`}>
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
        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display font-semibold text-slate-50">Puissance</h2>
            <span className="text-2xl font-bold tabular-nums text-amber-300">{heroPower(stats)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
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
            <p className="mt-2 text-xs text-slate-500">
              Attaque {magic ? "physique" : "magique"} : {unusedAtk} — inutilisée (seule la plus haute des deux compte).
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">
              Élément :{" "}
              {element ? (
                <span className="text-slate-200">
                  {ELEMENT_ICON[element]} {ELEMENT_LABEL[element]}
                </span>
              ) : (
                <span className="text-slate-500">neutre</span>
              )}
            </span>
            {ELEMENTS.filter((el) => stats[RES_KEY[el]] !== 0).map((el) => (
              <span
                key={el}
                title={`Résistance ${ELEMENT_LABEL[el].toLowerCase()}`}
                className={`rounded-full border border-white/10 px-2 py-0.5 ${stats[RES_KEY[el]] > 0 ? "text-emerald-300" : "text-red-400"}`}
              >
                {ELEMENT_ICON[el]} {stats[RES_KEY[el]]} %
              </span>
            ))}
            {stats.trapRes > 0 && <span className="rounded-full border border-white/10 px-2 py-0.5 text-sky-300">Pièges −{stats.trapRes} %</span>}
          </div>
          <details className="mt-3 text-xs text-slate-500">
            <summary className="cursor-pointer text-slate-400 hover:text-slate-200">Comment lire ces stats ?</summary>
            <p className="mt-1">
              La puissance résume le héros : son attaque utilisée, ses défenses, PV/10, sa vitesse, le gain moyen de ses critiques et
              un peu de ses résistances. Chaque choix des autres onglets affiche ce qu&apos;il y change (▲ / ▼). Un coup perd la moitié de
              la défense du même type chez la cible : mieux vaut tout miser sur un seul type d&apos;attaque. L&apos;élément vient du 1er
              sort élémentaire équipé ; il double presque les dégâts sur une faiblesse.
            </p>
          </details>
        </Card>

        <Card>
          <h2 className="font-display mb-2 font-semibold text-slate-50">Build</h2>
          <div className="space-y-0.5">
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
                    {i === 0 && <span className="ml-1 text-amber-400">· donjon : {RAID_EFFECT_NAME[spell.raidEffectTag]}</span>}
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
                  {tree.filter((n) => (hero.talents[n.id] ?? 0) > 0).length}/{tree.length} activés
                </Slot>
                {hero.talentPoints > 0 && <Slot className="border-amber-500/50 text-amber-300">{hero.talentPoints} pts à dépenser</Slot>}
              </BuildRow>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card accent={todos.some((t) => t.tone === "bad") ? "danger" : todos.length ? "gold" : "success"}>
          <h2 className="font-display mb-2 font-semibold text-slate-50">À améliorer</h2>
          {todos.length === 0 ? (
            <p className="text-sm text-emerald-300">Rien à signaler : ce héros tire le meilleur de ce que vous possédez.</p>
          ) : (
            <ul className="space-y-1">
              {todos.map((todo, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => goTo(todo.tab)}
                    className={`flex w-full gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-white/5 ${TODO_STYLE[todo.tone].color}`}
                  >
                    <span className="shrink-0">{TODO_STYLE[todo.tone].icon}</span>
                    <span>{todo.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-display mb-2 font-semibold text-slate-50">Classe</h2>
          {profile.unlockedClasses.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune classe obtenue pour l&apos;instant — tentez votre chance à l&apos;invocation.</p>
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
                <p className="mt-2 text-xs text-slate-500">
                  <span className="text-emerald-400">+</span> {classDef.strengths} · <span className="text-red-400">−</span> {classDef.weaknesses}
                </p>
              )}
              {hero.status !== "idle" && <p className="mt-2 text-xs text-amber-400">Rendez ce héros disponible pour changer de classe.</p>}
            </>
          )}
        </Card>

        <Card>
          <h2 className="font-display mb-2 font-semibold text-slate-50">Progression</h2>
          <p className="mb-1 flex justify-between text-xs text-slate-400">
            <span>
              Niveau {hero.level}/{cap}
            </span>
            <span>
              XP {hero.xp}/{xpToNextLevel(hero.level)}
            </span>
          </p>
          <ProgressBar value={hero.xp} max={xpToNextLevel(hero.level)} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-amber-400">
              {"★".repeat(star)}
              {"☆".repeat(MAX_STAR_RANK - star)}
            </span>
            {cost ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  {cost.rankTokens} jetons ({profile.rankTokens}) + {cost.gold} or
                </span>
                <Button size="sm" onClick={onAscend} disabled={!canAscend}>
                  Ascension
                </Button>
              </div>
            ) : (
              <span className="text-xs text-slate-400">Rang maximum</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">Chaque étoile : +8 % de stats et +10 niveaux maximum.</p>
        </Card>
      </div>
    </div>
  );
}
