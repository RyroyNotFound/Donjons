import { getSubclass } from "@/lib/game/content/classes";
import { getMonster } from "@/lib/game/content/dungeon";
import type { GachaPullResult, GachaRarity } from "@/types/game";

const RARITY_LABEL: Record<GachaRarity, string> = {
  commun: "Commun",
  rare: "Rare",
  epique: "Épique",
  legendaire: "Légendaire",
};

const RARITY_STYLE: Record<GachaRarity, string> = {
  commun: "border-zinc-700 bg-zinc-800 text-zinc-300",
  rare: "border-sky-500/50 bg-sky-500/10 text-sky-300",
  epique: "border-purple-500/50 bg-purple-500/10 text-purple-300",
  legendaire: "border-amber-500/60 bg-amber-500/10 text-amber-300",
};

const RARITY_ICON: Record<GachaRarity, string> = {
  commun: "✦",
  rare: "🔹",
  epique: "🔮",
  legendaire: "🌟",
};

function resultIcon(result: GachaPullResult): string {
  if (result.kind === "hero") return "🧙";
  if (result.kind === "shards") return "🔸";
  if (result.kind === "gold") return "🪙";
  if (result.kind === "monsterFragment") return "🧩";
  return "🎁";
}

function resultLabel(result: GachaPullResult): string {
  if (result.kind === "hero" && result.subclassId) {
    return `${result.heroName}, ${getSubclass(result.subclassId).name}`;
  }
  if (result.kind === "shards" && result.subclassId) {
    return `${result.amount} éclat${(result.amount ?? 0) > 1 ? "s" : ""} de ${getSubclass(result.subclassId).name}`;
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
        <div className="gacha-card-face gacha-card-mystery border border-zinc-700 bg-zinc-800 text-3xl">
          🎴
        </div>
        <div
          className={`gacha-card-face gacha-card-result border text-center text-sm ${RARITY_STYLE[result.rarity]}`}
        >
          <p className="text-lg">{resultIcon(result)}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide opacity-70">
            {RARITY_ICON[result.rarity]} {RARITY_LABEL[result.rarity]}
          </p>
          <p className="mt-1 px-1 font-medium leading-tight">{resultLabel(result)}</p>
        </div>
      </div>
    </div>
  );
}
