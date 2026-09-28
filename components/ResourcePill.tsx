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
      className={`items-center gap-1.5 px-2 text-xs font-medium tabular-nums ${colorClassName} ${
        hiddenOnMobile ? "hidden md:inline-flex" : "inline-flex"
      }`}
      title={label}
      aria-label={`${label} : ${value}`}
    >
      <Icon name={icon} className="h-4 w-4" />
      <span key={value} className="pulse-gain">
        {value.toLocaleString("fr-FR")}
      </span>
    </span>
  );
}
