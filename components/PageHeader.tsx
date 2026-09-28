"use client";

import { usePathname } from "next/navigation";
import { activeNavLink } from "@/lib/ui/nav";

export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** Small label above the title. Defaults to the page's nav section. */
  eyebrow?: string;
}) {
  const pathname = usePathname();
  const section = eyebrow ?? activeNavLink(pathname)?.group;
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {section && (
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.14em] text-gold/80">{section}</p>
        )}
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight text-fg sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
