import { Badge } from "@/components/Badge";
import { RARITY_BADGE, RARITY_LABEL } from "@/lib/ui/rarity";
import { getAffix } from "@/lib/game/content/affixes";
import { enhancedLine, ENHANCE_BONUS_PER_LEVEL, itemTotalStats } from "@/lib/game/engine/items";
import { formatStatBonus, ITEM_SLOT_LABEL } from "@/lib/game/statFormat";
import type { HeroStats, Item } from "@/types/game";

/** Compact item summary: name (+enhancement), rarity/slot/tier, total stats and each affix line. */
export function ItemCard({
  item,
  equippedByName,
  children,
  onRerollAffix,
  rerollLabel,
}: {
  item: Pick<Item, "name" | "rarity" | "slot" | "tier" | "statBonus" | "affixes" | "enhanceLevel">;
  equippedByName?: string;
  children?: React.ReactNode;
  /** When set, each affix line gets a reroll button (forge workshop). */
  onRerollAffix?: (affixIndex: number) => void;
  /** Cost/tooltip text for those buttons; absent = disabled. */
  rerollLabel?: string;
}) {
  const level = item.enhanceLevel ?? 0;
  // A line's own rolled value never changes (reforge and enhancement leave it alone); the
  // enhanced value it actually counts for is shown after the arrow.
  const formatLine = (stats: Partial<HeroStats>) =>
    level > 0 ? `${formatStatBonus(stats)} → ${formatStatBonus(enhancedLine(stats, level))}` : formatStatBonus(stats);
  return (
    <div className={`flex w-full flex-col rounded-lg border px-3 py-2 text-sm ${RARITY_BADGE[item.rarity]}`}>
      <p className="font-semibold text-slate-100">
        {item.name}
        {level > 0 && <span className="ml-1 text-amber-300">+{level}</span>}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Badge tone={item.rarity}>{RARITY_LABEL[item.rarity]}</Badge>
        <span>{ITEM_SLOT_LABEL[item.slot]}</span>
        <span>· Palier {item.tier ?? 1}</span>
        {equippedByName && <span className="text-emerald-400">· Équipé par {equippedByName}</span>}
      </div>
      <p className="mt-2 text-xs font-medium text-amber-300">Total : {formatStatBonus(itemTotalStats(item))}</p>
      <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
        {level > 0 && (
          <li className="text-amber-300/70">
            Amélioration +{level} : +{Math.round(level * ENHANCE_BONUS_PER_LEVEL * 100)}% sur chaque ligne (→ valeur réelle)
          </li>
        )}
        <li>Base : {formatLine(item.statBonus)}</li>
        {(item.affixes ?? []).map((affix, i) => (
          <li key={`${affix.affixId}-${i}`} className="flex items-center justify-between gap-2">
            <span>
              ◆ {getAffix(affix.affixId)?.suffix ?? "Affixe"} : {formatLine(affix.statBonus)}
            </span>
            {onRerollAffix && (
              <button
                type="button"
                title={rerollLabel ? `Réforger cette ligne (${rerollLabel})` : "Pas assez de ressources"}
                disabled={!rerollLabel}
                onClick={() => onRerollAffix(i)}
                className="shrink-0 rounded border border-white/15 px-1.5 py-0.5 text-[11px] text-slate-300 transition hover:border-amber-400/60 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ↻ Réforger
              </button>
            )}
          </li>
        ))}
      </ul>
      {children && <div className="mt-auto pt-3">{children}</div>}
    </div>
  );
}
