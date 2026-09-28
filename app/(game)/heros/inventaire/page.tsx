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
import { PageHeader } from "@/components/PageHeader";
import { buttonClasses } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Spinner } from "@/components/Spinner";
import { PageTransition } from "@/components/PageTransition";
import { ROLE_LABEL } from "@/lib/ui/role";

const LIST = "divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface";

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
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{name}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{description}</p>
        {value && <p className="mt-1 text-xs text-gold">{value}</p>}
      </div>
      {rank !== undefined ? (
        <Badge tone={rank >= MAX_COMPONENT_RANK ? "gold" : "neutral"} className="mt-0.5 shrink-0 tabular-nums">
          Rang {rank}/{MAX_COMPONENT_RANK}
        </Badge>
      ) : (
        <Badge tone="success" className="mt-0.5 shrink-0">
          Obtenu
        </Badge>
      )}
    </li>
  );
}

function EmptyHint() {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-fg-subtle">
      Rien d&apos;obtenu pour l&apos;instant — tentez l&apos;invocation.
    </p>
  );
}

function SectionTitle({ title, owned, total }: { title: string; owned: number; total: number }) {
  return (
    <h2 className="mb-3 flex items-baseline gap-2 font-semibold text-fg">
      {title}
      <span className="text-sm font-normal tabular-nums text-fg-subtle">
        {owned}/{total}
      </span>
    </h2>
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
      <div className="space-y-8">
        <PageHeader
          title="Inventaire"
          subtitle="Tout ce que vous avez obtenu à l'invocation — équipez-le sur n'importe quel héros. Un doublon fait monter le rang au lieu de doubler l'objet."
          action={
            <Link href="/gacha" transitionTypes={["nav-forward"]} className={buttonClasses("primary", "md")}>
              + Invocation
            </Link>
          }
        />

        <section>
          <SectionTitle title="Classes" owned={ownedClasses.length} total={CLASSES.length} />
          {ownedClasses.length === 0 ? (
            <EmptyHint />
          ) : (
            <ul className={LIST}>
              {ownedClasses.map((c) => (
                <ItemRow key={c.id} name={`${c.name} (${ROLE_LABEL[c.role]})`} description={c.description} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle title="Sorts" owned={ownedSpells.length} total={SPELLS.length} />
          {ownedSpells.length === 0 ? (
            <EmptyHint />
          ) : (
            <ul className={LIST}>
              {ownedSpells.map((s) => (
                <ItemRow
                  key={s.id}
                  name={s.element ? `${s.name} ${ELEMENT_ICON[s.element]}` : s.name}
                  description={s.description}
                  value={`Donjon : ${RAID_EFFECT_LABEL[s.raidEffectTag]} · ${ARENA_EFFECT_LABEL[s.arenaAbilityTag]}`}
                  rank={ranks[s.id]}
                />
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle title="Maîtrises" owned={ownedMasteries.length} total={MASTERIES.length} />
          {ownedMasteries.length === 0 ? (
            <EmptyHint />
          ) : (
            <ul className={LIST}>
              {ownedMasteries.map((m) => (
                <ItemRow
                  key={m.id}
                  name={m.name}
                  description={m.description}
                  value={formatStatBonus(m.statBonus)}
                  rank={ranks[m.id]}
                />
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle title="Talents" owned={ownedTalents.length} total={TALENTS.length} />
          <p className="-mt-1 mb-4 text-sm text-fg-muted">Groupés par classe, dans l&apos;ordre de l&apos;arbre.</p>
          {ownedTalents.length === 0 && <EmptyHint />}
          <div className="space-y-5">
            {talentsByClass.map(({ classDef, talents }) => (
              <div key={classDef.id}>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">{classDef.name}</h3>
                <ul className={LIST}>
                  {talents.map((t) => (
                    <ItemRow
                      key={t.id}
                      name={`${t.name} (T${t.tier})`}
                      description={t.description}
                      value={`${formatStatBonus(t.statBonusPerRank)} par rang`}
                      rank={ranks[t.id]}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
