export type CardAccent =
  | "default"
  | "commun"
  | "gold"
  | "rare"
  | "epique"
  | "legendaire"
  | "danger"
  | "success";

/** Border tint per accent — quiet by default, color only says "this matters". */
const ACCENT_BORDER: Record<CardAccent, string> = {
  default: "border-line",
  commun: "border-line",
  gold: "border-gold/25",
  rare: "border-sky-400/25",
  epique: "border-purple-400/25",
  legendaire: "border-amber-300/35",
  danger: "border-red-400/25",
  success: "border-emerald-400/25",
};

/** A 1px lit edge along the top of accented cards. */
const ACCENT_EDGE: Record<CardAccent, string | null> = {
  default: null,
  commun: null,
  gold: "via-gold/70",
  rare: "via-sky-300/60",
  epique: "via-purple-300/60",
  legendaire: "via-amber-200/80",
  danger: "via-red-400/60",
  success: "via-emerald-300/60",
};

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
  /** Overlays a faint pixel-art dungeon-stone texture on the card surface. */
  textured?: boolean;
}) {
  const edge = ACCENT_EDGE[accent];
  // Tailwind orders utilities by its own rules, not class-string order, so a caller's
  // `p-0` wouldn't reliably beat a built-in `p-5`: only pad when the caller didn't.
  const padding = /(^|\s)!?p[xytrbl]?-/.test(className) ? "" : "p-5";
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-surface ${padding} shadow-[inset_0_1px_0_rgb(255_255_255/0.04),0_1px_2px_rgb(0_0_0/0.3)] ${
        ACCENT_BORDER[accent]
      } ${interactive ? "transition-[border-color,background-color] duration-150 ease-out hover:border-line-strong hover:bg-surface-2" : ""} ${
        textured ? "bg-dungeon-stone" : ""
      } ${className}`}
    >
      {edge && (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent ${edge} to-transparent`}
        />
      )}
      {children}
    </div>
  );
}
