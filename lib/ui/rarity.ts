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

/** Gradient-border + corner-ornament color, consumed by Card's rarity accents. */
export const RARITY_FRAME: Record<RarityTier, { border: string; ornament: string }> = {
  commun: { border: "from-white/15 via-white/5 to-white/15", ornament: "text-white/20" },
  rare: { border: "from-sky-400/70 via-sky-300/25 to-sky-500/70", ornament: "text-sky-400/70" },
  epique: { border: "from-purple-400/70 via-purple-300/25 to-purple-500/70", ornament: "text-purple-400/70" },
  legendaire: { border: "from-amber-300/80 via-yellow-200/35 to-amber-400/80", ornament: "text-amber-300/80" },
};

/** Flat pill classes — Badge's rarity tones, and Forge's item-row borders. */
export const RARITY_BADGE: Record<RarityTier, string> = {
  commun: "border-white/15 bg-white/5 text-slate-300",
  rare: "border-sky-500/50 bg-sky-500/10 text-sky-300",
  epique: "border-purple-500/50 bg-purple-500/10 text-purple-300",
  legendaire: "border-amber-400/60 bg-amber-400/10 text-amber-300",
};

/** Vivid gradient "card face" + glow, used for the gacha reveal moment. */
export const RARITY_GACHA_FACE: Record<RarityTier, string> = {
  commun: "border-white/15 bg-white/5 text-slate-300",
  rare: "border-sky-400/60 bg-gradient-to-b from-sky-500/15 to-sky-900/20 text-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.25)]",
  epique: "border-purple-400/60 bg-gradient-to-b from-purple-500/15 to-purple-900/20 text-purple-300 shadow-[0_0_16px_rgba(192,132,252,0.3)]",
  legendaire: "border-amber-300/70 bg-gradient-to-b from-amber-400/20 to-amber-900/20 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.45)]",
};

/** Inline colors for native <select> options (Tailwind classes don't reach option popups
 *  reliably): dark rarity-tinted background + readable text. `none` = empty choice. */
export const RARITY_OPTION_STYLE: Record<RarityTier | "none", { backgroundColor: string; color: string }> = {
  none: { backgroundColor: "#111827", color: "#94a3b8" },
  commun: { backgroundColor: "#1f2937", color: "#e2e8f0" },
  rare: { backgroundColor: "#0c2d4a", color: "#7dd3fc" },
  epique: { backgroundColor: "#2e1748", color: "#d8b4fe" },
  legendaire: { backgroundColor: "#3d2a05", color: "#fcd34d" },
};
