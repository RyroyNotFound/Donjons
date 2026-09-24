export type PanelTone = "neutral" | "highlight" | "owned";

const TONE_STYLES: Record<PanelTone, string> = {
  neutral: "border-white/10 bg-black/20",
  highlight: "border-amber-500/40 bg-amber-500/5",
  owned: "border-emerald-500/30 bg-emerald-500/5",
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
