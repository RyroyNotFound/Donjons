"use client";

import { getTalentsForClass } from "@/lib/game/content/talents";
import { MAX_COMPONENT_RANK } from "@/lib/game/economy";
import { formatStatBonus } from "@/lib/game/statFormat";
import { talentImpact, talentSpendable, type HeroContext } from "@/lib/game/heroInsights";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Panel } from "@/components/Panel";
import { ImpactBadge } from "@/components/heroes/ImpactBadge";
import type { ClassDefinition } from "@/types/game";

export function HeroTalents({
  ctx,
  classDef,
  busy,
  onSpend,
}: {
  ctx: HeroContext;
  classDef: ClassDefinition;
  busy: boolean;
  onSpend: (nodeId: string) => void;
}) {
  const { hero, ranks } = ctx;
  const tree = getTalentsForClass(classDef.id);
  const ownedCount = tree.filter((n) => (ranks[n.id] ?? 0) > 0).length;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display font-semibold text-slate-50">Talents — {classDef.name}</h2>
        <p className="text-sm text-slate-400">
          Points à dépenser : <span className="font-semibold text-amber-400">{hero.talentPoints}</span> · talents obtenus : {ownedCount}/{tree.length}
        </p>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        1 point par niveau. Un talent s&apos;obtient à l&apos;invocation (ou à l&apos;Observatoire), puis s&apos;active avec des points, dans
        n&apos;importe quel ordre. Les points restent acquis à cette classe si vous en changez.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {tree.map((node) => {
          const owned = (ranks[node.id] ?? 0) > 0;
          const invested = hero.talents[node.id] ?? 0;
          const maxed = invested >= node.maxRank;
          const starOk = !node.requiresStarRank || (hero.starRank ?? 1) >= node.requiresStarRank;
          const canSpend = !busy && talentSpendable(hero, ranks, node);
          return (
            <Panel key={node.id} tone={maxed ? "highlight" : "neutral"} dim={!owned}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-slate-100">
                  {node.name}
                  {owned && (
                    <span className="ml-1 text-xs text-slate-500">
                      rang {ranks[node.id]}/{MAX_COMPONENT_RANK}
                    </span>
                  )}
                </p>
                <span className="text-xs tabular-nums text-slate-400">
                  {invested}/{node.maxRank}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-amber-400">{formatStatBonus(node.statBonusPerRank)} par point</p>
              <p className="mt-0.5 text-xs text-slate-500">{node.description}</p>
              {!owned ? (
                <p className="mt-2 text-xs text-slate-500">🔒 À obtenir à l&apos;invocation ou à l&apos;Observatoire</p>
              ) : maxed ? (
                <p className="mt-2 text-xs text-emerald-300">Maîtrisé</p>
              ) : (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <ImpactBadge impact={talentImpact(ctx, node)} />
                  <Button size="sm" onClick={() => onSpend(node.id)} disabled={!canSpend}>
                    {!starOk ? `Nécessite ${node.requiresStarRank}★` : `${invested === 0 ? "Activer" : "+1"} (${node.cost} pt)`}
                  </Button>
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </Card>
  );
}
