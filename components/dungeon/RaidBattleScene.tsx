"use client";

import { ProgressBar } from "@/components/ProgressBar";
import { ELEMENT_ICON, ELEMENT_LABEL } from "@/lib/game/engine/elements";
import { RAID_EFFECT_NAME } from "@/lib/game/engine/dungeonCombat";
import { explainBattle } from "@/lib/game/raidBattleInsights";
import { ROLE_GLOW, ROLE_GRADIENT, ROLE_LABEL } from "@/lib/ui/role";
import type { RaidBattleReport, RaidBattleUnitReport, RaidLogEntry } from "@/types/game";

const INSIGHT_COLOR = { good: "text-emerald-300", bad: "text-red-300", neutral: "text-slate-300" } as const;

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
    ? "ring-2 ring-amber-400"
    : targeted
      ? healed
        ? "ring-2 ring-emerald-400"
        : "ring-2 ring-red-500"
      : "ring-1 ring-white/5";
  const hero = unit.side === "hero";
  return (
    <div className={`rounded-lg bg-black/30 p-2 transition-all duration-150 ${ring} ${dead ? "opacity-40" : ""}`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={`truncate font-semibold ${dead ? "text-slate-500 line-through" : hero ? "text-sky-200" : "text-red-200"}`}>
          {unit.name}
          {dead && " 💀"}
        </span>
        <span className="shrink-0 tabular-nums text-slate-400">
          {hp}/{unit.maxHp}
        </span>
      </div>
      <div className="my-1">
        <ProgressBar
          value={hp}
          max={unit.maxHp}
          colorClassName={unit.role ? ROLE_GRADIENT[unit.role] : "from-red-500 to-red-700"}
          glowClassName={unit.role ? ROLE_GLOW[unit.role] : ""}
          label={`Points de vie de ${unit.name}`}
        />
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
        {unit.role && <span>{ROLE_LABEL[unit.role]}</span>}
        <span title={`Attaque ${unit.atkType === "phys" ? "physique" : "magique"}`}>
          ⚔️ {unit.atk} {unit.atkType === "phys" ? "phys." : "mag."}
        </span>
        <span title="Défense physique / magique : chaque coup reçu perd la moitié de la défense correspondante">
          🛡️ {unit.defPhys}/{unit.defMag}
        </span>
        {unit.element && <span title={`Élément : ${ELEMENT_LABEL[unit.element]}`}>{ELEMENT_ICON[unit.element]}</span>}
        {unit.raidEffectTag && unit.raidEffectTag !== "disarm" && unit.raidEffectTag !== "scout" && (
          <span className="text-violet-300">
            ✦ {RAID_EFFECT_NAME[unit.raidEffectTag]}
            {unit.raidEffectBonus && " ★"}
          </span>
        )}
        {!!unit.weakened && <span className="text-amber-400">💫×{unit.weakened}</span>}
      </div>
    </div>
  );
}

function ReportTable({ report }: { report: RaidBattleReport }) {
  const rows = [...report.units].sort((a, b) => (a.side === b.side ? b.dealt - a.dealt : a.side === "hero" ? -1 : 1));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="py-1 text-left font-normal">Combattant</th>
            <th className="py-1 text-right font-normal">Infligés</th>
            <th className="py-1 text-right font-normal">Subis</th>
            <th className="py-1 text-right font-normal">Soins</th>
            <th className="py-1 text-right font-normal">PV fin</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((u) => (
            <tr key={u.id} className="border-t border-white/5">
              <td className={`py-1 ${u.side === "hero" ? "text-sky-200" : "text-red-200"}`}>{u.name}</td>
              <td className="py-1 text-right text-slate-200">{u.dealt}</td>
              <td className="py-1 text-right text-slate-400">{u.taken}</td>
              <td className="py-1 text-right text-emerald-300">{u.healed || "—"}</td>
              <td className={`py-1 text-right ${u.hpEnd <= 0 ? "text-slate-600" : "text-slate-300"}`}>
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
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wide text-slate-400">
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
      {!done && last && <p className="min-h-[2.5rem] rounded bg-black/20 px-2 py-1 text-sm text-slate-200">{last.message}</p>}
      {done && (
        <div className={`space-y-3 rounded-lg border p-3 ${report.outcome === "cleared" ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          <p className={`font-display font-bold ${report.outcome === "cleared" ? "text-emerald-300" : "text-red-300"}`}>
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
