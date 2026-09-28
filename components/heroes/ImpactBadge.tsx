import type { Impact } from "@/lib/game/heroInsights";

/** "▲ +12" / "▼ −4" / "= 0" power change of a choice, plus what's wasted in it for this hero.
 *  `kept` = the choice is already applied: the badge then reads as what it currently brings. */
export function ImpactBadge({ impact, kept = false }: { impact: Impact; kept?: boolean }) {
  const { delta, wasted, trapRes } = impact;
  const tone =
    delta > 0
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
      : delta < 0
        ? "border-red-400/25 bg-red-400/10 text-red-300"
        : "border-line bg-white/[0.04] text-fg-muted";
  const label = delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "= 0";
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[11px] leading-4">
      <span
        className={`rounded-md border px-1.5 py-px font-semibold tabular-nums ${tone}`}
        title={kept ? "Puissance apportée par ce choix" : "Changement de puissance si vous l'équipez"}
      >
        {label}
      </span>
      {wasted.length > 0 && (
        <span
          className="rounded-md border border-red-400/25 bg-red-400/10 px-1.5 py-px text-red-300"
          title="Ce héros frappe avec l'autre type d'attaque : cette partie du bonus ne sert à rien"
        >
          {wasted.join(", ")} inutile
        </span>
      )}
      {trapRes && delta <= 0 && (
        <span
          className="rounded-md border border-sky-400/25 bg-sky-400/10 px-1.5 py-px text-sky-300"
          title="La résistance aux pièges ne compte pas dans la puissance mais réduit les dégâts de pièges en raid"
        >
          utile en raid (pièges)
        </span>
      )}
    </span>
  );
}
