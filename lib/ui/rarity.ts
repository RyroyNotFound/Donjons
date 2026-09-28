import type { IconName } from "@/lib/ui/icons";

export type RarityTier = "commun" | "rare" | "epique" | "legendaire";

export const RARITY_LABEL: Record<RarityTier, string> = {
  commun: "Commun",
  rare: "Rare",
  epique: "Épique",
  legendaire: "Légendaire",
};

export const RARITY_ICON: Record<RarityTier, IconName> = {
  commun: "rarity-commun",
  rare: "rarity-rare",
  epique: "rarity-epique",
  legendaire: "rarity-legendaire",
};

/** Text color per tier, for item names and inline labels. */
export const RARITY_TEXT: Record<RarityTier, string> = {
  commun: "text-fg",
  rare: "text-sky-300",
  epique: "text-purple-300",
  legendaire: "text-amber-300",
};

/** Flat pill classes — Badge's rarity tones, and Forge's item-row borders. */
export const RARITY_BADGE: Record<RarityTier, string> = {
  commun: "border-line-strong bg-white/[0.04] text-fg-muted",
  rare: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  epique: "border-purple-400/25 bg-purple-400/10 text-purple-300",
  legendaire: "border-amber-300/35 bg-amber-300/10 text-amber-300",
};

/** "Card face" for the gacha reveal moment — the one place rarity gets to glow. */
export const RARITY_GACHA_FACE: Record<RarityTier, string> = {
  commun: "border-line-strong bg-surface-2 text-fg-muted",
  rare: "border-sky-400/40 bg-gradient-to-b from-sky-400/15 to-surface text-sky-300 shadow-[0_0_20px_-4px_rgb(56_189_248/0.35)]",
  epique:
    "border-purple-400/40 bg-gradient-to-b from-purple-400/15 to-surface text-purple-300 shadow-[0_0_20px_-4px_rgb(192_132_252/0.4)]",
  legendaire:
    "border-amber-300/50 bg-gradient-to-b from-amber-300/20 to-surface text-amber-300 shadow-[0_0_24px_-4px_rgb(252_211_77/0.5)]",
};

/** Inline colors for native <select> options (Tailwind classes don't reach option popups
 *  reliably): dark rarity-tinted background + readable text. `none` = empty choice. */
export const RARITY_OPTION_STYLE: Record<RarityTier | "none", { backgroundColor: string; color: string }> = {
  none: { backgroundColor: "#1a1816", color: "#a39d93" },
  commun: { backgroundColor: "#22201d", color: "#ece8e1" },
  rare: { backgroundColor: "#0f2638", color: "#7dd3fc" },
  epique: { backgroundColor: "#28183a", color: "#d8b4fe" },
  legendaire: { backgroundColor: "#352609", color: "#fcd34d" },
};
