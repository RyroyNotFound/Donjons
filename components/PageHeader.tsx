export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-glow-gold font-display text-3xl font-bold tracking-wide">{title}</h1>
        <div className="mt-2 flex items-center gap-2">
          <span className="h-px w-8 bg-gradient-to-r from-amber-500/70 to-transparent" />
          <svg width="6" height="6" viewBox="0 0 6 6" className="rotate-45" aria-hidden>
            <rect width="6" height="6" className="fill-amber-500/70" />
          </svg>
          <span className="h-px w-20 bg-gradient-to-l from-amber-500/70 to-transparent" />
        </div>
        {subtitle && <p className="mt-2.5 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
