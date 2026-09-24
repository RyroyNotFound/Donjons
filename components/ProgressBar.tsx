const DEFAULT_COLOR = "from-amber-400 to-amber-600";
const DEFAULT_GLOW = "shadow-[0_0_10px_rgba(245,158,11,0.55)]";

export function ProgressBar({
  value,
  max,
  colorClassName = DEFAULT_COLOR,
  glowClassName,
  label,
}: {
  value: number;
  max: number;
  colorClassName?: string;
  /** Explicit glow shadow class, e.g. from ROLE_GLOW. Omit to get the default amber glow (matches prior `glow={true}` behavior); pass "" to disable the glow entirely. */
  glowClassName?: string;
  label?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const resolvedGlow = glowClassName ?? DEFAULT_GLOW;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-white/5"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${colorClassName} ${resolvedGlow}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
