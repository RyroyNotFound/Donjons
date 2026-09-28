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
  gold: "border-gold/30 bg-gold/10 text-gold",
  rare: RARITY_BADGE.rare,
  epique: RARITY_BADGE.epique,
  legendaire: RARITY_BADGE.legendaire,
  success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  danger: "border-red-400/25 bg-red-400/10 text-red-300",
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
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 ${TONE_STYLES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
