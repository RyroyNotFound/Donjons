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
    <Card>
      <p className="text-slate-300">{message}</p>
      <Link
        href={backHref}
        transitionTypes={["nav-back"]}
        className="mt-3 inline-block text-amber-400 hover:underline"
      >
        ← {backLabel}
      </Link>
    </Card>
  );
}
