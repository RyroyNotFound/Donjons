"use client";

import Link from "next/link";
import { useGameData } from "@/lib/game/GameDataProvider";
import { CLASSES } from "@/lib/game/content/classes";
import { SPELLS } from "@/lib/game/content/spells";
import { ELEMENT_ICON } from "@/lib/game/engine/elements";
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
import { ROLE_LABEL } from "@/lib/ui/role";

function ItemRow({
  name,
  description,
  value,
  rank,
}: {
  name: string;
  description: string;
  value?: string;
  /** When set, shows "Rang X/MAX" instead of a plain "Obtenu" badge (spells/talents/masteries only). */
  rank?: number;
}) {
  return (
    <Panel tone="owned" className="flex items-center justify-between gap-3">
      <div>
        <p className="font-medium text-slate-100">{name}</p>
        <p className="text-xs text-slate-400">{description}</p>
        {value && <p className="mt-0.5 text-xs text-amber-400">{value}</p>}
      </div>
      <span className="text-xs font-medium text-emerald-400">
        {rank !== undefined ? `Rang ${rank}/${MAX_COMPONENT_RANK}` : "Obtenu"}
      </span>
    </Panel>
  );
}

function EmptyHint() {
  return <p className="text-sm text-slate-500">Rien d&apos;obtenu pour l&apos;instant — tentez l&apos;invocation.</p>;
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

  // Only unlocked content is listed; the (x/total) counters still hint at what's left to find.
  const ranks = profile.componentRanks;
  const isOwned = (id: string) => (ranks[id] ?? 0) > 0;
  const ownedClasses = CLASSES.filter((c) => profile.unlockedClasses.includes(c.id));
  const ownedSpells = SPELLS.filter((s) => isOwned(s.id));
  const ownedMasteries = MASTERIES.filter((m) => isOwned(m.id));
  const ownedTalents = TALENTS.filter((t) => isOwned(t.id));
  const talentsByClass = CLASSES.map((c) => ({
    classDef: c,
    talents: ownedTalents.filter((t) => t.classId === c.id),
  })).filter((g) => g.talents.length > 0);

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
          Classes ({ownedClasses.length}/{CLASSES.length})
        </h2>
        {ownedClasses.length === 0 && <EmptyHint />}
        <div className="grid gap-2 sm:grid-cols-2">
          {ownedClasses.map((c) => (
            <ItemRow key={c.id} name={`${c.name} (${ROLE_LABEL[c.role]})`} description={c.description} />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-display mb-3 font-semibold text-slate-50">
          Sorts ({ownedSpells.length}/{SPELLS.length})
        </h2>
        {ownedSpells.length === 0 && <EmptyHint />}
        <div className="grid gap-2 sm:grid-cols-2">
          {ownedSpells.map((s) => (
            <ItemRow
              key={s.id}
              name={s.element ? `${s.name} ${ELEMENT_ICON[s.element]}` : s.name}
              description={s.description}
              value={`Donjon : ${RAID_EFFECT_LABEL[s.raidEffectTag]} · ${ARENA_EFFECT_LABEL[s.arenaAbilityTag]}`}
              rank={ranks[s.id]}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-display mb-3 font-semibold text-slate-50">
          Maîtrises ({ownedMasteries.length}/{MASTERIES.length})
        </h2>
        {ownedMasteries.length === 0 && <EmptyHint />}
        <div className="grid gap-2 sm:grid-cols-2">
          {ownedMasteries.map((m) => (
            <ItemRow
              key={m.id}
              name={m.name}
              description={m.description}
              value={formatStatBonus(m.statBonus)}
              rank={ranks[m.id]}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-display mb-1 font-semibold text-slate-50">
          Talents ({ownedTalents.length}/{TALENTS.length})
        </h2>
        <p className="mb-4 text-sm text-slate-400">Groupés par classe, dans l&apos;ordre de l&apos;arbre.</p>
        {ownedTalents.length === 0 && <EmptyHint />}
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
