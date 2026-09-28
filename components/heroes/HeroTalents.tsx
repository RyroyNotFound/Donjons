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
    <Card className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-semibold text-fg">Talents — {classDef.name}</h2>
          <p className="text-sm text-fg-muted">
            Points à dépenser : <span className="font-semibold tabular-nums text-gold">{hero.talentPoints}</span> · talents
            obtenus : <span className="tabular-nums text-fg">{ownedCount}/{tree.length}</span>
          </p>
        </div>
        <p className="text-xs leading-relaxed text-fg-subtle">
          1 point par niveau. Un talent s&apos;obtient à l&apos;invocation (ou à l&apos;Observatoire), puis s&apos;active avec des points, dans
          n&apos;importe quel ordre. Les points restent acquis à cette classe si vous en changez.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {tree.map((node) => {
          const owned = (ranks[node.id] ?? 0) > 0;
          const invested = hero.talents[node.id] ?? 0;
          const maxed = invested >= node.maxRank;
          const starOk = !node.requiresStarRank || (hero.starRank ?? 1) >= node.requiresStarRank;
          const canSpend = !busy && talentSpendable(hero, ranks, node);
          return (
            <Panel key={node.id} tone={maxed ? "highlight" : "neutral"} dim={!owned} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-fg">
                  {node.name}
                  {owned && (
                    <span className="ml-1.5 text-xs font-normal tabular-nums text-fg-subtle">
                      rang {ranks[node.id]}/{MAX_COMPONENT_RANK}
                    </span>
                  )}
                </p>
                <span className={`text-xs font-semibold tabular-nums ${maxed ? "text-gold" : "text-fg-muted"}`}>
                  {invested}/{node.maxRank}
                </span>
              </div>
              <p className="mt-1 text-xs text-gold">{formatStatBonus(node.statBonusPerRank)} par point</p>
              <p className="mt-0.5 text-xs leading-relaxed text-fg-subtle">{node.description}</p>
              <div className="mt-auto pt-3">
                {!owned ? (
                  <p className="text-xs text-fg-subtle">À obtenir à l&apos;invocation ou à l&apos;Observatoire</p>
                ) : maxed ? (
                  <p className="text-xs font-medium text-emerald-300">Maîtrisé</p>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <ImpactBadge impact={talentImpact(ctx, node)} />
                    <Button size="sm" onClick={() => onSpend(node.id)} disabled={!canSpend}>
                      {!starOk ? `Nécessite ${node.requiresStarRank}★` : `${invested === 0 ? "Activer" : "+1"} (${node.cost} pt)`}
                    </Button>
                  </div>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </Card>
  );
}
