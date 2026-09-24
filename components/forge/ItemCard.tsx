import { Badge } from "@/components/Badge";
import { RARITY_BADGE, RARITY_LABEL } from "@/lib/ui/rarity";
import { getAffix } from "@/lib/game/content/affixes";
import { itemTotalStats } from "@/lib/game/engine/items";
import { formatStatBonus, ITEM_SLOT_LABEL } from "@/lib/game/statFormat";
import type { Item } from "@/types/game";

/** Compact item summary: name (+enhancement), rarity/slot/tier, total stats and each affix line. */
export function ItemCard({
  item,
  equippedByName,
  children,
}: {
  item: Pick<Item, "name" | "rarity" | "slot" | "tier" | "statBonus" | "affixes" | "enhanceLevel">;
  equippedByName?: string;
  children?: React.ReactNode;
}) {
  const level = item.enhanceLevel ?? 0;
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
      <p className="mt-2 text-xs font-medium text-amber-300">{formatStatBonus(itemTotalStats(item))}</p>
      <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
        <li>Base : {formatStatBonus(item.statBonus)}</li>
        {(item.affixes ?? []).map((affix, i) => (
          <li key={`${affix.affixId}-${i}`}>
            ◆ {getAffix(affix.affixId)?.suffix ?? "Affixe"} : {formatStatBonus(affix.statBonus)}
          </li>
        ))}
      </ul>
      {children && <div className="mt-auto pt-3">{children}</div>}
    </div>
  );
}
