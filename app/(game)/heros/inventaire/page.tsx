"use client";

import Link from "next/link";
import { useGameData } from "@/lib/game/GameDataProvider";
import { CLASSES } from "@/lib/game/content/classes";
import { SPELLS } from "@/lib/game/content/spells";
import { TALENTS } from "@/lib/game/content/talents";
import { MASTERIES } from "@/lib/game/content/masteries";
import { formatStatBonus, RAID_EFFECT_LABEL, ARENA_EFFECT_LABEL } from "@/lib/game/statFormat";
import { MAX_COMPONENT_RANK } from "@/lib/game/economy";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { buttonClasses } from "@/components/Button";
import { Panel } from "@/components/Panel";
import { Spinner } from "@/components/Spinner";
import { PageTransition } from "@/components/PageTransition";

function ItemRow({
  name,
  description,
  value,
  owned,
  rank,
}: {
  name: string;
  description: string;
  value?: string;
  owned: boolean;
  /** When set, shows "Rang X/MAX" instead of a plain "Obtenu" badge (spells/talents/masteries only). */
  rank?: number;
}) {
  return (
    <Panel tone={owned ? "owned" : "neutral"} dim={!owned} className="flex items-center justify-between gap-3">
      <div>
        <p className="font-medium text-slate-100">{name}</p>
        <p className="text-xs text-slate-400">{description}</p>
        {value && <p className="mt-0.5 text-xs text-amber-400">{value}</p>}
      </div>
      <span className={`text-xs font-medium ${owned ? "text-emerald-400" : "text-slate-500"}`}>
        {owned ? (rank !== undefined ? `Rang ${rank}/${MAX_COMPONENT_RANK}` : "Obtenu") : "Non obtenu"}
      </span>
    </Panel>
  );
}

export default function InventairePage() {
  const { profile } = useGameData();

  if (!profile) {
    return (
      <PageTransition>
        <Spinner label="Chargement..." />
      </PageTransition>
    );
  }

  const ranks = profile.componentRanks;
  const ownedSpellCount = SPELLS.filter((s) => (ranks[s.id] ?? 0) > 0).length;
  const ownedMasteryCount = MASTERIES.filter((m) => (ranks[m.id] ?? 0) > 0).length;
  const ownedTalentCount = TALENTS.filter((t) => (ranks[t.id] ?? 0) > 0).length;
  const talentsByClass = CLASSES.map((c) => ({ classDef: c, talents: TALENTS.filter((t) => t.classId === c.id) }));

  return (
    <PageTransition>
    <div className="space-y-6">
      <PageHeader
        title="Inventaire"
        subtitle="Tout ce que vous avez obtenu à l'invocation — équipez-le sur n'importe quel héros. Un doublon fait monter le rang au lieu de doubler l'objet."
        action={
          <Link href="/gacha" transitionTypes={["nav-forward"]} className={buttonClasses("primary", "md")}>
            + Invocation
          </Link>
        }
      />

      <Card>
        <h2 className="font-display mb-3 font-semibold text-slate-50">
          Classes ({profile.unlockedClasses.length}/{CLASSES.length})
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {CLASSES.map((c) => (
            <ItemRow
              key={c.id}
              name={`${c.name} (${c.role})`}
              description={c.description}
              owned={profile.unlockedClasses.includes(c.id)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-display mb-3 font-semibold text-slate-50">
          Sorts ({ownedSpellCount}/{SPELLS.length})
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {SPELLS.map((s) => (
            <ItemRow
              key={s.id}
              name={s.name}
              description={s.description}
              value={`Donjon : ${RAID_EFFECT_LABEL[s.raidEffectTag]} · ${ARENA_EFFECT_LABEL[s.arenaAbilityTag]}`}
              owned={(ranks[s.id] ?? 0) > 0}
              rank={ranks[s.id]}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-display mb-3 font-semibold text-slate-50">
          Maîtrises ({ownedMasteryCount}/{MASTERIES.length})
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {MASTERIES.map((m) => (
            <ItemRow
              key={m.id}
              name={m.name}
              description={m.description}
              value={formatStatBonus(m.statBonus)}
              owned={(ranks[m.id] ?? 0) > 0}
              rank={ranks[m.id]}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-display mb-1 font-semibold text-slate-50">
          Talents ({ownedTalentCount}/{TALENTS.length})
        </h2>
        <p className="mb-4 text-sm text-slate-400">Groupés par classe, dans l&apos;ordre de l&apos;arbre.</p>
        <div className="space-y-5">
          {talentsByClass.map(({ classDef, talents }) => (
            <div key={classDef.id}>
              <h3 className="mb-2 text-sm font-semibold text-amber-400">{classDef.name}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {talents.map((t) => (
                  <ItemRow
                    key={t.id}
                    name={`${t.name} (T${t.tier})`}
                    description={t.description}
                    value={`${formatStatBonus(t.statBonusPerRank)} par rang`}
                    owned={(ranks[t.id] ?? 0) > 0}
                    rank={ranks[t.id]}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
    </PageTransition>
  );
}
