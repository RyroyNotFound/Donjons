"use client";

import { useMemo, useState } from "react";
import { callApi } from "@/lib/api/client";
import { CLASSES } from "@/lib/game/content/classes";
import { SPELLS } from "@/lib/game/content/spells";
import { TALENTS } from "@/lib/game/content/talents";
import { MASTERIES } from "@/lib/game/content/masteries";
import { observatoryPrice, RANK_TOKEN_PACK, type ObservatoryKind } from "@/lib/game/content/observatory";
import { MAX_COMPONENT_RANK } from "@/lib/game/economy";
import { ELEMENT_ICON } from "@/lib/game/engine/elements";
import { formatStatBonus } from "@/lib/game/statFormat";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Panel } from "@/components/Panel";
import { selectClass } from "@/components/Field";
import { ROLE_LABEL } from "@/lib/ui/role";
import { focusRing } from "@/lib/ui/a11y";
import type { UserProfile } from "@/types/game";

function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path d="M8 13V3.5M4 7.5l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 4.9-.7" strokeLinecap="round" />
    </svg>
  );
}

type Tab = ObservatoryKind | "rankTokens";

const TABS: { id: Tab; label: string }[] = [
  { id: "mastery", label: "Maîtrises" },
  { id: "spell", label: "Sorts" },
  { id: "talent", label: "Talents" },
  { id: "class", label: "Classes" },
  { id: "rankTokens", label: "Jetons de rang" },
];

interface Row {
  id: string;
  name: string;
  detail: string;
  rank: number;
}

function rowsFor(tab: ObservatoryKind, profile: UserProfile, talentClass: string): Row[] {
  const ranks = profile.componentRanks ?? {};
  if (tab === "class") {
    return CLASSES.map((c) => ({
      id: c.id,
      name: c.name,
      detail: `${ROLE_LABEL[c.role]} — ${c.strengths}`,
      rank: profile.unlockedClasses.includes(c.id) ? 1 : 0,
    }));
  }
  if (tab === "spell") {
    return SPELLS.map((s) => ({
      id: s.id,
      name: s.element ? `${s.name} ${ELEMENT_ICON[s.element]}` : s.name,
      detail: s.description,
      rank: ranks[s.id] ?? 0,
    }));
  }
  if (tab === "talent") {
    return TALENTS.filter((t) => t.classId === talentClass).map((t) => ({
      id: t.id,
      name: `${t.name} (palier ${t.tier})`,
      detail: `${formatStatBonus(t.statBonusPerRank)} par rang`,
      rank: ranks[t.id] ?? 0,
    }));
  }
  return MASTERIES.map((m) => ({ id: m.id, name: m.name, detail: formatStatBonus(m.statBonus), rank: ranks[m.id] ?? 0 }));
}

/** The Observatoire (spark shop): spends gacha stardust on a chosen unlock or rank-up. */
export function Observatory({ profile }: { profile: UserProfile }) {
  const [tab, setTab] = useState<Tab>("mastery");
  const [talentClass, setTalentClass] = useState<string>(profile.unlockedClasses[0] ?? CLASSES[0].id);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stardust = profile.stardust ?? 0;

  const rows = useMemo(
    () => (tab === "rankTokens" ? [] : rowsFor(tab, profile, talentClass)),
    [tab, profile, talentClass],
  );

  async function buy(kind: Tab, refId?: string) {
    setError(null);
    setBusyId(refId ?? kind);
    try {
      await callApi("/api/gacha/observatory", { kind, refId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card accent="epique" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-fg">Observatoire</h2>
        <p className="text-sm font-medium tabular-nums text-purple-300">✦ {stardust} poussière d&apos;étoile</p>
      </div>
      <p className="text-sm leading-relaxed text-fg-muted">
        Chaque tirage laisse de la poussière d&apos;étoile (plus pour les raretés hautes, et le triple pour un doublon déjà au
        maximum). Échangez-la ici contre l&apos;élément de votre choix : les taux d&apos;invocation ne changent pas, mais la malchance ne
        bloque jamais un ensemble.
      </p>
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
        <div className="inline-flex rounded-lg border border-line bg-white/[0.02] p-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(t.id)}
                className={`h-8 shrink-0 whitespace-nowrap rounded-md px-3 text-sm transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] ${focusRing} ${
                  active
                    ? "bg-surface-3 text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                    : "text-fg-muted hover:text-fg"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "talent" && (
        <select value={talentClass} onChange={(e) => setTalentClass(e.target.value)} className={selectClass}>
          {CLASSES.map((c) => (
            <option key={c.id} value={c.id}>
              Arbre : {c.name}
              {profile.unlockedClasses.includes(c.id) ? "" : " (classe non possédée)"}
            </option>
          ))}
        </select>
      )}

      {tab === "rankTokens" ? (
        <Panel className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Icon name="rank-token" className="h-6 w-6 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-fg">{RANK_TOKEN_PACK.amount} jetons de rang</p>
              <p className="text-xs text-fg-muted">Pour faire monter vos héros en étoiles.</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="tabular-nums"
            onClick={() => buy("rankTokens")}
            disabled={busyId !== null || stardust < RANK_TOKEN_PACK.price}
          >
            <span className="text-purple-300" aria-hidden>
              ✦
            </span>
            {RANK_TOKEN_PACK.price}
          </Button>
        </Panel>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto rounded-lg border border-line bg-black/20">
          {rows.map((row) => {
            const kind = tab as ObservatoryKind;
            const price = observatoryPrice(kind, row.rank);
            const status =
              kind === "class"
                ? row.rank > 0
                  ? "Débloquée"
                  : "Non obtenue"
                : row.rank > 0
                  ? `Rang ${row.rank}/${MAX_COMPONENT_RANK}`
                  : "Non obtenu";
            return (
              <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{row.name}</p>
                  <p className="truncate text-xs text-fg-muted">{row.detail}</p>
                  <p className={`text-xs tabular-nums ${row.rank > 0 ? "text-gold" : "text-fg-faint"}`}>{status}</p>
                </div>
                {price === null ? (
                  <span className="shrink-0 text-xs font-medium text-emerald-300">Max</span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0 tabular-nums"
                    onClick={() => buy(kind, row.id)}
                    disabled={busyId !== null || stardust < price}
                    title={row.rank > 0 ? "Monter d'un rang" : "Débloquer"}
                    aria-label={`${row.rank > 0 ? "Monter d'un rang" : "Débloquer"} : ${price} poussière d'étoile`}
                  >
                    {row.rank > 0 ? <ArrowUpIcon /> : <UnlockIcon />}
                    <span className="text-purple-300" aria-hidden>
                      ✦
                    </span>
                    {price}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </Card>
  );
}
