import { Badge } from "@/components/Badge";
import { RARITY_LABEL, RARITY_TEXT } from "@/lib/ui/rarity";
import { focusRing } from "@/lib/ui/a11y";
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
  plain = false,
}: {
  item: Pick<Item, "name" | "rarity" | "slot" | "tier" | "statBonus" | "affixes" | "enhanceLevel">;
  equippedByName?: string;
  children?: React.ReactNode;
  /** When set, each affix line gets a reroll button (forge workshop). */
  onRerollAffix?: (affixIndex: number) => void;
  /** Cost/tooltip text for those buttons; absent = disabled. */
  rerollLabel?: string;
  /** Drops the card's own border/padding, for rows inside an already-bordered list. */
  plain?: boolean;
}) {
  const level = item.enhanceLevel ?? 0;
  // A line's own rolled value never changes (reforge and enhancement leave it alone); the
  // enhanced value it actually counts for is shown after the arrow.
  const formatLine = (stats: Partial<HeroStats>) =>
    level > 0 ? `${formatStatBonus(stats)} → ${formatStatBonus(enhancedLine(stats, level))}` : formatStatBonus(stats);
  return (
    <div
      className={`flex w-full min-w-0 flex-col text-sm ${
        plain ? "" : "rounded-lg border border-line bg-white/[0.025] px-3 py-2.5"
      }`}
    >
      <p className={`font-semibold ${RARITY_TEXT[item.rarity]}`}>
        {item.name}
        {level > 0 && <span className="ml-1 tabular-nums text-gold">+{level}</span>}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
        <Badge tone={item.rarity}>{RARITY_LABEL[item.rarity]}</Badge>
        <span>{ITEM_SLOT_LABEL[item.slot]}</span>
        <span>· Palier {item.tier ?? 1}</span>
        {equippedByName && <span className="text-emerald-300">· Équipé par {equippedByName}</span>}
      </div>
      <p className="mt-2 text-xs font-medium tabular-nums text-fg">Total : {formatStatBonus(itemTotalStats(item))}</p>
      <ul className="mt-1 space-y-0.5 text-xs tabular-nums text-fg-muted">
        {level > 0 && (
          <li className="text-fg-subtle">
            Amélioration +{level} : +{Math.round(level * ENHANCE_BONUS_PER_LEVEL * 100)}% sur chaque ligne (→ valeur réelle)
          </li>
        )}
        <li>Base : {formatLine(item.statBonus)}</li>
        {(item.affixes ?? []).map((affix, i) => (
          <li key={`${affix.affixId}-${i}`} className="flex items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="text-fg-faint" aria-hidden>
                ◆
              </span>{" "}
              {getAffix(affix.affixId)?.suffix ?? "Affixe"} : {formatLine(affix.statBonus)}
            </span>
            {onRerollAffix && (
              <button
                type="button"
                title={rerollLabel ? `Réforger cette ligne (${rerollLabel})` : "Pas assez de ressources"}
                disabled={!rerollLabel}
                onClick={() => onRerollAffix(i)}
                className={`h-7 shrink-0 rounded-md border border-line-strong px-2 text-[11px] font-medium text-fg-muted transition-[transform,border-color,color] duration-150 ease-out enabled:hover:border-gold/40 enabled:hover:text-gold enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
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
