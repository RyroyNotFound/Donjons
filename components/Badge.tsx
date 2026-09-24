import { RARITY_BADGE } from "@/lib/ui/rarity";

export type BadgeTone =
  | "neutral"
  | "commun"
  | "gold"
  | "rare"
  | "epique"
  | "legendaire"
  | "success"
  | "danger"
  | "info";

const TONE_STYLES: Record<BadgeTone, string> = {
  neutral: RARITY_BADGE.commun,
  commun: RARITY_BADGE.commun,
  gold: "border-amber-500/50 bg-amber-500/10 text-amber-300",
  rare: RARITY_BADGE.rare,
  epique: RARITY_BADGE.epique,
  legendaire: RARITY_BADGE.legendaire,
  success: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  danger: "border-red-500/50 bg-red-500/10 text-red-300",
  info: RARITY_BADGE.rare,
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_STYLES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
