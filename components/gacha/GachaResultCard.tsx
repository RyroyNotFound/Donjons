import { getClass } from "@/lib/game/content/classes";
import { getSpell } from "@/lib/game/content/spells";
import { getTalent } from "@/lib/game/content/talents";
import { getMastery } from "@/lib/game/content/masteries";
import { getMonster } from "@/lib/game/content/dungeon";
import { RARITY_LABEL, RARITY_GACHA_FACE, RARITY_ICON } from "@/lib/ui/rarity";
import { MONSTER_SPRITE } from "@/lib/ui/monsterSprites";
import { Icon } from "@/components/Icon";
import { SpriteAnimation } from "@/components/SpriteAnimation";
import type { IconName } from "@/lib/ui/icons";
import type { GachaPullResult } from "@/types/game";

function resultIconName(result: GachaPullResult): IconName {
  if (result.kind === "class") return "book";
  if (result.kind === "spell") return "wand";
  if (result.kind === "talent") return "leaf";
  if (result.kind === "mastery") return "medallion";
  if (result.kind === "rankToken") return "rank-token";
  if (result.kind === "gold") return "gold";
  if (result.kind === "monsterFragment") return "bone";
  return "mystery";
}

function resultLabel(result: GachaPullResult): string {
  if (result.kind === "class" && result.refId) {
    return `Classe : ${getClass(result.refId).name}`;
  }
  if (result.kind === "spell" && result.refId) {
    return `Sort : ${getSpell(result.refId).name}`;
  }
  if (result.kind === "talent" && result.refId) {
    return `Talent : ${getTalent(result.refId).name}`;
  }
  if (result.kind === "mastery" && result.refId) {
    return `Maîtrise : ${getMastery(result.refId).name}`;
  }
  if (result.kind === "rankToken") {
    return `${result.amount} jeton${(result.amount ?? 0) > 1 ? "s" : ""} de rang`;
  }
  if (result.kind === "gold") {
    return `${result.amount} or`;
  }
  if (result.kind === "monsterFragment" && result.monsterRefId) {
    return `Fragment de ${getMonster(result.monsterRefId).name}`;
  }
  return "Récompense";
}

export function GachaResultCard({ result, index }: { result: GachaPullResult; index: number }) {
  const isLegendary = result.rarity === "legendaire";

  return (
    <div
      className="gacha-card-wrap aspect-[3/4]"
      style={{ "--delay": `${index * 0.18}s` } as React.CSSProperties}
    >
      <div className={`gacha-card-inner ${isLegendary ? "gacha-card-legendary" : ""}`}>
        <div className="gacha-card-face gacha-card-mystery border border-line-strong bg-gradient-to-b from-surface-3 to-surface shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
          <span aria-hidden className="absolute inset-2 rounded-lg border border-gold/15" />
          <Icon name="mystery" className="h-8 w-8 opacity-70" />
        </div>
        <div
          className={`gacha-card-face gacha-card-result border text-center text-sm ${RARITY_GACHA_FACE[result.rarity]}`}
        >
          {result.kind === "monsterFragment" && result.monsterRefId && MONSTER_SPRITE[result.monsterRefId] ? (
            <SpriteAnimation
              sheet={MONSTER_SPRITE[result.monsterRefId]}
              frames={4}
              frameSize={32}
              className="mx-auto h-8 w-8"
            />
          ) : (
            <Icon name={resultIconName(result)} className="mx-auto h-6 w-6" />
          )}
          <p className="mt-2 flex items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-[0.14em] opacity-80">
            <Icon name={RARITY_ICON[result.rarity]} className="h-3 w-3" /> {RARITY_LABEL[result.rarity]}
          </p>
          <p className="mt-1 px-1 font-semibold leading-tight">{resultLabel(result)}</p>
          {!!result.stardust && (
            <p className="mt-1 text-[11px] tabular-nums text-purple-300">+{result.stardust} ✦</p>
          )}
        </div>
      </div>
    </div>
  );
}
