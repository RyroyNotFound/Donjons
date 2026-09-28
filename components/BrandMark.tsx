const SIZES = {
  sm: { box: "h-7 w-7 rounded-lg", icon: "h-4 w-4", text: "text-base" },
  lg: { box: "h-12 w-12 rounded-xl", icon: "h-6 w-6", text: "text-3xl" },
} as const;

/** Crossed-swords seal + wordmark. */
export function BrandMark({ size = "sm", showText = true }: { size?: keyof typeof SIZES; showText?: boolean }) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center gap-2.5 ${size === "lg" ? "flex-col" : ""}`}>
      <span
        className={`flex items-center justify-center border border-gold/30 bg-gradient-to-b from-gold/20 to-gold/5 text-gold shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] ${s.box}`}
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={s.icon}
        >
          <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
          <path d="m13 19 6-6" />
          <path d="m16 16 4 4" />
          <path d="m19 21 2-2" />
          <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
          <path d="m5 14 4 4" />
          <path d="m7 17-3 3" />
          <path d="m3 19 2 2" />
        </svg>
      </span>
      {showText && (
        <span className={`font-display font-semibold tracking-wide text-fg ${s.text}`}>Donjons</span>
      )}
    </span>
  );
}
