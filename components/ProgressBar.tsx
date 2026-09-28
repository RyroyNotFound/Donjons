const DEFAULT_COLOR = "from-gold-deep to-gold";

export function ProgressBar({
  value,
  max,
  colorClassName = DEFAULT_COLOR,
  glowClassName = "",
  label,
  size = "md",
}: {
  value: number;
  max: number;
  colorClassName?: string;
  /** Optional glow shadow class, e.g. from ROLE_GLOW. None by default. */
  glowClassName?: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-white/[0.06] ${size === "sm" ? "h-1" : "h-1.5"}`}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ease-out ${colorClassName} ${glowClassName}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
