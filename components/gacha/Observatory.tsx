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
import { Chip } from "@/components/Chip";
import { Button } from "@/components/Button";
import { Panel } from "@/components/Panel";
import { selectClass } from "@/components/Field";
import { ROLE_LABEL } from "@/lib/ui/role";
import type { UserProfile } from "@/types/game";

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
    <Card accent="epique">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display font-semibold text-slate-50">🔭 Observatoire</h2>
        <p className="text-sm font-semibold text-violet-300">✦ {stardust} poussière d&apos;étoile</p>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        Chaque tirage laisse de la poussière d&apos;étoile (plus pour les raretés hautes, et le triple pour un doublon déjà au
        maximum). Échangez-la ici contre l&apos;élément de votre choix : les taux d&apos;invocation ne changent pas, mais la malchance ne
        bloque jamais un ensemble.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Chip key={t.id} selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>

      {tab === "talent" && (
        <select value={talentClass} onChange={(e) => setTalentClass(e.target.value)} className={`${selectClass} mb-3`}>
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
          <div>
            <p className="font-medium text-slate-100">{RANK_TOKEN_PACK.amount} jetons de rang</p>
            <p className="text-xs text-slate-400">Pour faire monter vos héros en étoiles.</p>
          </div>
          <Button
            size="sm"
            onClick={() => buy("rankTokens")}
            disabled={busyId !== null || stardust < RANK_TOKEN_PACK.price}
          >
            ✦ {RANK_TOKEN_PACK.price}
          </Button>
        </Panel>
      ) : (
        <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
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
              <Panel key={row.id} className="flex items-center justify-between gap-3" tone={row.rank > 0 ? "highlight" : "neutral"}>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-100">{row.name}</p>
                  <p className="truncate text-xs text-slate-400">{row.detail}</p>
                  <p className="text-xs text-slate-500">{status}</p>
                </div>
                {price === null ? (
                  <span className="shrink-0 text-xs text-emerald-400">Max</span>
                ) : (
                  <Button
                    size="sm"
                    className="shrink-0"
                    onClick={() => buy(kind, row.id)}
                    disabled={busyId !== null || stardust < price}
                    title={row.rank > 0 ? "Monter d'un rang" : "Débloquer"}
                  >
                    {row.rank > 0 ? "⬆" : "🔓"} ✦ {price}
                  </Button>
                )}
              </Panel>
            );
          })}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </Card>
  );
}
