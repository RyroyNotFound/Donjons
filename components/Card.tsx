import { RARITY_FRAME } from "@/lib/ui/rarity";

export type CardAccent =
  | "default"
  | "commun"
  | "gold"
  | "rare"
  | "epique"
  | "legendaire"
  | "danger"
  | "success";

const ACCENT_BORDER: Record<CardAccent, string> = {
  default: RARITY_FRAME.commun.border,
  commun: RARITY_FRAME.commun.border,
  gold: "from-amber-400/70 via-amber-300/25 to-amber-500/70",
  rare: RARITY_FRAME.rare.border,
  epique: RARITY_FRAME.epique.border,
  legendaire: RARITY_FRAME.legendaire.border,
  danger: "from-red-500/60 via-red-400/20 to-red-500/60",
  success: "from-emerald-400/60 via-emerald-300/20 to-emerald-500/60",
};

const ACCENT_ORNAMENT: Record<CardAccent, string> = {
  default: RARITY_FRAME.commun.ornament,
  commun: RARITY_FRAME.commun.ornament,
  gold: "text-amber-400/70",
  rare: RARITY_FRAME.rare.ornament,
  epique: RARITY_FRAME.epique.ornament,
  legendaire: RARITY_FRAME.legendaire.ornament,
  danger: "text-red-400/60",
  success: "text-emerald-400/60",
};

/** Small filigree corner bracket, echoed in the opposite corner — the
    game's recurring frame motif instead of a plain rounded rectangle. */
function CornerOrnament({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M1 9.5V1h8.5" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="1" cy="1" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function Card({
  children,
  className = "",
  accent = "default",
  interactive = false,
  textured = false,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: CardAccent;
  interactive?: boolean;
  /** Overlays a faint pixel-art dungeon-stone texture on the card's ink surface. */
  textured?: boolean;
}) {
  const ornamentColor = ACCENT_ORNAMENT[accent];
  return (
    <div
      className={`group relative rounded-2xl bg-gradient-to-br ${ACCENT_BORDER[accent]} p-px shadow-lg shadow-black/40 ${
        interactive ? "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-900/20" : ""
      } ${className}`}
    >
      <div
        className={`relative h-full overflow-hidden rounded-[15px] bg-[var(--ink-900)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-12px_24px_-16px_rgba(0,0,0,0.5)] ${
          textured ? "bg-dungeon-stone" : ""
        }`}
        style={{
          backgroundImage:
            "radial-gradient(ellipse 140% 80% at 50% -20%, rgba(255,255,255,0.05), transparent 60%)",
        }}
      >
        <CornerOrnament className={`pointer-events-none absolute left-2 top-2 ${ornamentColor}`} />
        <CornerOrnament
          className={`pointer-events-none absolute bottom-2 right-2 rotate-180 ${ornamentColor}`}
        />
        {children}
      </div>
    </div>
  );
}
