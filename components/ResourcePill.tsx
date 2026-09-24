import { Icon } from "@/components/Icon";
import type { IconName } from "@/lib/ui/icons";

export function ResourcePill({
  icon,
  label,
  value,
  colorClassName,
  hiddenOnMobile = false,
}: {
  icon: IconName;
  label: string;
  value: number;
  colorClassName: string;
  hiddenOnMobile?: boolean;
}) {
  return (
    <span
      className={`items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium ${colorClassName} ${
        hiddenOnMobile ? "hidden sm:inline-flex" : "inline-flex"
      }`}
      aria-label={`${label} : ${value}`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      <span key={value} className="pulse-gain">{value}</span>
    </span>
  );
}
