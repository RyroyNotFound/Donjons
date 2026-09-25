"use client";

import { useState } from "react";
import { itemTotalStats } from "@/lib/game/engine/items";
import { formatStatBonus, ITEM_SLOT_LABEL } from "@/lib/game/statFormat";
import { itemImpact, itemsForSlot, type HeroContext } from "@/lib/game/heroInsights";
import { RARITY_BADGE, RARITY_LABEL } from "@/lib/ui/rarity";
import { Card } from "@/components/Card";
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
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display font-semibold text-slate-50">{ITEM_SLOT_LABEL[slot]}</h2>
        {current && (
          <Button size="sm" variant="ghost" onClick={() => onEquip(slot, null)} disabled={busy}>
            Retirer
          </Button>
        )}
      </div>
      {current ? <ItemCard item={current} /> : <p className="text-sm text-red-300">Emplacement vide.</p>}

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {candidates.length ? "Autres objets disponibles — meilleur d'abord" : "Aucun autre objet disponible"}
      </p>
      <ul className="space-y-2">
        {shown.map(({ item, impact }) => (
          <li key={item.id} className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 ${RARITY_BADGE[item.rarity]}`}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {item.name}
                {item.enhanceLevel ? ` +${item.enhanceLevel}` : ""}
                <span className="ml-1 text-[11px] opacity-70">
                  {RARITY_LABEL[item.rarity]} · palier {item.tier ?? 1}
                </span>
              </p>
              <p className="truncate text-[11px] text-slate-400">{formatStatBonus(itemTotalStats(item))}</p>
              <ImpactBadge impact={impact} />
            </div>
            <Button size="sm" onClick={() => onEquip(slot, item.id)} disabled={busy}>
              Équiper
            </Button>
          </li>
        ))}
      </ul>
      {candidates.length > SHOWN && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs text-amber-400 hover:underline">
          {all ? "Réduire" : `Voir les ${candidates.length - SHOWN} autres`}
        </button>
      )}
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
