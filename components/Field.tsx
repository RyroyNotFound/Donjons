export const inputClass =
  "h-10 w-full rounded-lg border border-line-strong bg-black/25 px-3 text-sm text-fg outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-fg-faint focus:border-gold/50 focus:ring-2 focus:ring-gold/15";

export const selectClass =
  "h-10 w-full rounded-lg border border-line-strong bg-black/25 px-2.5 text-sm text-fg outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-gold/50 focus:ring-2 focus:ring-gold/15";

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-medium text-fg-muted">{children}</label>;
}
