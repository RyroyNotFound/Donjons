export const inputClass =
  "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-400/70 focus:ring-1 focus:ring-amber-400/40";

export const selectClass =
  "w-full rounded-lg border border-white/15 bg-black/30 px-2.5 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-400/70 focus:ring-1 focus:ring-amber-400/40";

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{children}</label>;
}
