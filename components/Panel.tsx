export type PanelTone = "neutral" | "highlight" | "owned";

const TONE_STYLES: Record<PanelTone, string> = {
  neutral: "border-line bg-white/[0.025]",
  highlight: "border-gold/30 bg-gold/[0.06]",
  owned: "border-emerald-400/20 bg-emerald-400/[0.05]",
};

const PADDING_STYLES = {
  sm: "px-3 py-2",
  md: "p-3",
} as const;

export function Panel({
  tone = "neutral",
  dim = false,
  padding = "md",
  as: Tag = "div",
  className = "",
  children,
}: {
  tone?: PanelTone;
  /** Greys the panel out, e.g. for a locked/unowned item. */
  dim?: boolean;
  padding?: keyof typeof PADDING_STYLES;
  as?: "div" | "li";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag
      className={`rounded-lg border ${PADDING_STYLES[padding]} ${TONE_STYLES[tone]} ${
        dim ? "opacity-50" : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
