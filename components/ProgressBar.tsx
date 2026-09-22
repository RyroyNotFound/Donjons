export function ProgressBar({
  value,
  max,
  colorClassName = "bg-amber-500",
}: {
  value: number;
  max: number;
  colorClassName?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
      <div
        className={`h-full rounded-full ${colorClassName} transition-all`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
