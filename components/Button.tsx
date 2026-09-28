import { focusRing } from "@/lib/ui/a11y";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

/** Solid gold fill with a hairline top highlight — the one loud color in the UI. */
export const PRIMARY_GRADIENT =
  "bg-gold text-canvas shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_1px_2px_rgb(0_0_0/0.4)] hover:bg-gold-bright";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: PRIMARY_GRADIENT,
  secondary:
    "border border-line-strong bg-surface-2 text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] hover:bg-surface-3",
  danger:
    "bg-red-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(0_0_0/0.4)] hover:bg-red-500",
  ghost: "text-fg-muted hover:bg-white/[0.05] hover:text-fg",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = "",
) {
  return `inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-[transform,background-color,border-color,color,opacity] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${focusRing} ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`;
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
