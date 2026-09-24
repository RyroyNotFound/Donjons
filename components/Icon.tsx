import { ICONS, type IconName } from "@/lib/ui/icons";

export function Icon({
  name,
  label,
  className = "",
}: {
  name: IconName;
  /** Accessible label. Omit for purely decorative icons (e.g. next to text that already says it). */
  label?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed-size decorative pixel-art icon, not a content image
    <img
      src={ICONS[name]}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      className={`pixel-art inline-block ${className}`}
    />
  );
}
