"use client";

import { useState } from "react";
import { itemTotalStats } from "@/lib/game/engine/items";
import { formatStatBonus, ITEM_SLOT_LABEL } from "@/lib/game/statFormat";
import { itemImpact, itemsForSlot, type HeroContext } from "@/lib/game/heroInsights";
import { RARITY_LABEL, RARITY_TEXT } from "@/lib/ui/rarity";
import { focusRing } from "@/lib/ui/a11y";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ItemCard } from "@/components/forge/ItemCard";
import { ImpactBadge } from "@/components/heroes/ImpactBadge";
import type { ItemSlot } from "@/types/game";

const SLOTS: ItemSlot[] = ["weapon", "armor", "trinket"];
const SHOWN = 4;

function SlotCard({ ctx, slot, busy, onEquip }: { ctx: HeroContext; slot: ItemSlot; busy: boolean; onEquip: (slot: ItemSlot, itemId: string | null) => void }) {
  const [all, setAll] = useState(false);
  const currentId = ctx.hero.equipment[slot];
  const current = currentId ? ctx.items.find((i) => i.id === currentId) : undefined;
  const candidates = itemsForSlot(ctx, slot)
    .filter((i) => i.id !== currentId)
    .map((item) => ({ item, impact: itemImpact(ctx, item) }))
    .sort((a, b) => b.impact.delta - a.impact.delta);
  const shown = all ? candidates : candidates.slice(0, SHOWN);

  return (
    <Card className="space-y-4">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="font-semibold text-fg">{ITEM_SLOT_LABEL[slot]}</h2>
        {current && (
          <Button size="sm" variant="ghost" onClick={() => onEquip(slot, null)} disabled={busy}>
            Retirer
          </Button>
        )}
      </div>
      {current ? (
        <ItemCard item={current} />
      ) : (
        <p className="rounded-lg border border-dashed border-red-400/30 px-3 py-2.5 text-sm text-red-300">Emplacement vide.</p>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">
          {candidates.length ? "Autres objets disponibles — meilleur d'abord" : "Aucun autre objet disponible"}
        </p>
        {shown.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white/[0.02]">
            {shown.map(({ item, impact }) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0 space-y-1">
                  <p className={`truncate text-sm font-medium ${RARITY_TEXT[item.rarity]}`}>
                    {item.name}
                    {item.enhanceLevel ? <span className="tabular-nums"> +{item.enhanceLevel}</span> : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge tone={item.rarity}>{RARITY_LABEL[item.rarity]}</Badge>
                    <span className="text-[11px] tabular-nums text-fg-subtle">palier {item.tier ?? 1}</span>
                  </div>
                  <p className="truncate text-[11px] tabular-nums text-fg-muted">{formatStatBonus(itemTotalStats(item))}</p>
                  <ImpactBadge impact={impact} />
                </div>
                <Button size="sm" onClick={() => onEquip(slot, item.id)} disabled={busy}>
                  Équiper
                </Button>
              </li>
            ))}
          </ul>
        )}
        {candidates.length > SHOWN && (
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            className={`mt-2 rounded text-xs text-gold transition-colors duration-150 ease-out hover:text-gold-bright ${focusRing}`}
          >
            {all ? "Réduire" : `Voir les ${candidates.length - SHOWN} autres`}
          </button>
        )}
      </div>
    </Card>
  );
}

export function HeroEquipment({ ctx, busy, onEquip }: { ctx: HeroContext; busy: boolean; onEquip: (slot: ItemSlot, itemId: string | null) => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {SLOTS.map((slot) => (
        <SlotCard key={slot} ctx={ctx} slot={slot} busy={busy} onEquip={onEquip} />
      ))}
    </div>
  );
}
