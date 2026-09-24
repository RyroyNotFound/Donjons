export function Spinner({ label }: { label?: string }) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3 py-16"
      role="status"
      aria-live="polite"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400"
        aria-hidden
      />
      {label ? <p className="text-sm text-slate-400">{label}</p> : <span className="sr-only">Chargement…</span>}
    </div>
  );
}
