import Link from "next/link";
import { Card } from "@/components/Card";

export function EmptyState({
  message,
  backHref,
  backLabel,
}: {
  message: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <Card className="text-center">
      <p className="text-fg-muted">{message}</p>
      <Link
        href={backHref}
        transitionTypes={["nav-back"]}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold-bright"
      >
        ← {backLabel}
      </Link>
    </Card>
  );
}
