"use client";

import { ProgressBar } from "@/components/ProgressBar";
import { Icon } from "@/components/Icon";
import { ELEMENT_ICON, ELEMENT_LABEL } from "@/lib/game/engine/elements";
import { RAID_EFFECT_NAME } from "@/lib/game/engine/dungeonCombat";
import { explainBattle } from "@/lib/game/raidBattleInsights";
import { ROLE_GRADIENT, ROLE_LABEL } from "@/lib/ui/role";
import type { RaidBattleReport, RaidBattleUnitReport, RaidLogEntry } from "@/types/game";

const INSIGHT_COLOR = { good: "text-emerald-300", bad: "text-red-300", neutral: "text-fg-muted" } as const;

function UnitCard({
  unit,
  hp,
  acting,
  targeted,
  healed,
}: {
  unit: RaidBattleUnitReport;
  hp: number;
  acting: boolean;
  targeted: boolean;
  healed: boolean;
}) {
  const dead = hp <= 0;
  const ring = acting
    ? "ring-2 ring-gold/60"
    : targeted
      ? healed
        ? "ring-2 ring-emerald-400/70"
        : "ring-2 ring-red-400/70"
      : "ring-1 ring-line";
  const hero = unit.side === "hero";
  return (
    <div
      className={`rounded-lg bg-white/[0.025] p-2 transition-[box-shadow,opacity] duration-150 ease-out ${ring} ${dead ? "opacity-40" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={`truncate font-semibold ${dead ? "text-fg-subtle line-through" : hero ? "text-sky-200" : "text-red-200"}`}>
          {unit.name}
          {dead && " 💀"}
        </span>
        <span className="shrink-0 tabular-nums text-fg-muted">
          {hp}
          <span className="text-fg-faint">/{unit.maxHp}</span>
        </span>
      </div>
      <div className="my-1.5">
        <ProgressBar
          value={hp}
          max={unit.maxHp}
          colorClassName={unit.role ? ROLE_GRADIENT[unit.role] : "from-red-500 to-red-700"}
          label={`Points de vie de ${unit.name}`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums text-fg-subtle">
        {unit.role && <span>{ROLE_LABEL[unit.role]}</span>}
        <span
          className="inline-flex items-center gap-0.5"
          title={`Attaque ${unit.atkType === "phys" ? "physique" : "magique"}`}
        >
          <Icon name="sword" className="h-3 w-3" />
          {unit.atk} {unit.atkType === "phys" ? "phys." : "mag."}
        </span>
        <span
          className="inline-flex items-center gap-0.5"
          title="Défense physique / magique : chaque coup reçu perd la moitié de la défense correspondante"
        >
          <Icon name="shield" className="h-3 w-3" />
          {unit.defPhys}/{unit.defMag}
        </span>
        {unit.element && <span title={`Élément : ${ELEMENT_LABEL[unit.element]}`}>{ELEMENT_ICON[unit.element]}</span>}
        {unit.raidEffectTag && unit.raidEffectTag !== "disarm" && unit.raidEffectTag !== "scout" && (
          <span className="text-purple-300">
            ✦ {RAID_EFFECT_NAME[unit.raidEffectTag]}
            {unit.raidEffectBonus && " ★"}
          </span>
        )}
        {!!unit.weakened && <span className="text-amber-300">💫×{unit.weakened}</span>}
      </div>
    </div>
  );
}

function ReportTable({ report }: { report: RaidBattleReport }) {
  const rows = [...report.units].sort((a, b) => (a.side === b.side ? b.dealt - a.dealt : a.side === "hero" ? -1 : 1));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-fg-subtle">
          <tr>
            <th className="py-1.5 text-left font-medium">Combattant</th>
            <th className="py-1.5 text-right font-medium">Infligés</th>
            <th className="py-1.5 text-right font-medium">Subis</th>
            <th className="py-1.5 text-right font-medium">Soins</th>
            <th className="py-1.5 text-right font-medium">PV fin</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((u) => (
            <tr key={u.id} className="border-t border-line">
              <td className={`py-1.5 ${u.side === "hero" ? "text-sky-200" : "text-red-200"}`}>{u.name}</td>
              <td className="py-1.5 text-right text-fg">{u.dealt}</td>
              <td className="py-1.5 text-right text-red-300/80">{u.taken}</td>
              <td className="py-1.5 text-right text-emerald-300">{u.healed || "—"}</td>
              <td className={`py-1.5 text-right ${u.hpEnd <= 0 ? "text-fg-faint" : "text-fg-muted"}`}>
                {u.hpEnd <= 0 ? "K.O." : `${u.hpEnd}/${u.maxHp}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Live view of the latest room fight: both camps side by side, HP following the log as it's revealed,
 * the acting unit and its target highlighted — then a breakdown explaining the outcome.
 * `entries` are the fight's entries revealed so far; `report` comes from the fight's last entry.
 */
export function RaidBattleScene({
  entries,
  report,
  done,
}: {
  entries: RaidLogEntry[];
  report: RaidBattleReport;
  done: boolean;
}) {
  const hp = new Map(report.units.map((u) => [u.id, u.hpStart]));
  for (const e of entries) if (e.targetId && e.hpAfter !== undefined) hp.set(e.targetId, e.hpAfter);
  const last = entries[entries.length - 1];
  const round = last?.round ?? 0;
  const heroes = report.units.filter((u) => u.side === "hero");
  const enemies = report.units.filter((u) => u.side === "enemy");

  const card = (u: RaidBattleUnitReport) => (
    <UnitCard
      key={u.id}
      unit={u}
      hp={done ? u.hpEnd : (hp.get(u.id) ?? u.hpStart)}
      acting={!done && last?.actorId === u.id}
      targeted={!done && last?.targetId === u.id}
      healed={last?.kind === "heal"}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium uppercase tabular-nums tracking-[0.14em] text-fg-subtle">
          {done ? `Combat terminé — ${report.rounds} tour${report.rounds > 1 ? "s" : ""}` : round > 0 ? `Tour ${round}` : "Engagement"}
        </span>
        {!done && last?.side && (
          <span className={last.side === "hero" ? "text-sky-300" : "text-red-300"}>
            {last.side === "hero" ? "À vous d'agir" : "L'ennemi riposte"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-sky-300">Vos héros</p>
          {heroes.map(card)}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-red-300">Ennemis</p>
          {enemies.map(card)}
        </div>
      </div>
      {!done && last && (
        <p className="min-h-[2.5rem] rounded-lg border border-line bg-black/25 px-3 py-2 text-sm tabular-nums text-fg">
          {last.message}
        </p>
      )}
      {done && (
        <div
          className={`space-y-3 rounded-lg border p-3 ${
            report.outcome === "cleared" ? "border-emerald-400/25 bg-emerald-400/[0.05]" : "border-red-400/25 bg-red-400/[0.05]"
          }`}
        >
          <p className={`font-semibold ${report.outcome === "cleared" ? "text-emerald-300" : "text-red-300"}`}>
            {report.outcome === "cleared" ? "Victoire" : "Défaite"} — pourquoi ?
          </p>
          <ul className="space-y-1 text-sm">
            {explainBattle(report).map((insight, i) => (
              <li key={i} className={INSIGHT_COLOR[insight.tone]}>
                • {insight.text}
              </li>
            ))}
          </ul>
          <ReportTable report={report} />
        </div>
      )}
    </div>
  );
}
