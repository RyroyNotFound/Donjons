import { focusRing } from "@/lib/ui/a11y";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

export const PRIMARY_GRADIENT =
  "bg-gradient-to-b from-amber-400 to-amber-600 text-[var(--ink-950)] shadow-md shadow-amber-950/40 hover:from-amber-300 hover:to-amber-500";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: PRIMARY_GRADIENT,
  secondary:
    "border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:border-white/25",
  danger:
    "bg-gradient-to-b from-red-500 to-red-700 text-white shadow-md shadow-red-950/40 hover:from-red-400 hover:to-red-600",
  ghost: "text-slate-400 hover:text-slate-100 hover:bg-white/5",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = "",
) {
  return `inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold tracking-wide transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${focusRing} ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}
