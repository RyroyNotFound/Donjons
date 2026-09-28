export function Spinner({ label }: { label?: string }) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3 py-16"
      role="status"
      aria-live="polite"
    >
      {/* Fast spin reads as a faster load. */}
      <div
        className="h-6 w-6 animate-[spin_600ms_linear_infinite] rounded-full border-2 border-white/10 border-t-gold"
        aria-hidden
      />
      {label ? <p className="text-sm text-fg-subtle">{label}</p> : <span className="sr-only">Chargement…</span>}
    </div>
  );
}
