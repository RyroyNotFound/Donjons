import { focusRing } from "@/lib/ui/a11y";

export function Chip({
  children,
  selected,
  disabled = false,
  onClick,
  fullWidth = false,
  className = "",
}: {
  children: React.ReactNode;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  fullWidth?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${focusRing} ${
        fullWidth ? "block w-full text-left" : ""
      } ${
        selected
          ? "border-amber-500 bg-amber-500/20 text-amber-300"
          : "border-white/10 text-slate-300 hover:bg-white/5"
      } ${className}`}
    >
      {children}
    </button>
  );
}
