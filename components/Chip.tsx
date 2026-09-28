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
      className={`rounded-lg border px-3 py-1.5 text-sm transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${focusRing} ${
        fullWidth ? "block w-full text-left" : ""
      } ${
        selected
          ? "border-gold/45 bg-gold/10 text-gold"
          : "border-line text-fg-muted hover:border-line-strong hover:bg-white/[0.04] hover:text-fg"
      } ${className}`}
    >
      {children}
    </button>
  );
}
