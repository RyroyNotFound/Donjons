import { ARENA_SPELL_TAGS } from "@/lib/game/arena/engine";
import { isPercentStat, STAT_KEYS } from "@/lib/game/engine/elements";
import { attackPower, EXECUTE_THRESHOLD, RAID_MAGNITUDE, raidHealAmount } from "@/lib/game/engine/dungeonCombat";
import type { ArenaAbilityTag, HeroStats, ItemSlot, RaidEffectTag, Role } from "@/types/game";

export const STAT_LABEL: Record<keyof HeroStats, string> = {
  hp: "PV",
  atkPhys: "ATQ phys.",
  atkMag: "ATQ mag.",
  defPhys: "DEF phys.",
  defMag: "DEF mag.",
  spd: "VIT",
  crit: "Crit.",
  critDmg: "Dégâts crit.",
  resFeu: "Rés. feu",
  resGlace: "Rés. glace",
  resFoudre: "Rés. foudre",
  resSacre: "Rés. sacré",
  resOmbre: "Rés. ombre",
  trapRes: "Rés. pièges",
};

/** One stat value with its unit: "12" for flat stats, "12%" for crit/resistances. */
export function formatStatValue(stat: keyof HeroStats, value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return isPercentStat(stat) ? `${rounded}%` : `${rounded}`;
}

/** Renders a partial stat bonus as "+12 PV, +3 ATQ, +5% Crit." — the actual numbers, not a vague "flat bonus" label. */
export function formatStatBonus(bonus: Partial<HeroStats>): string {
  return STAT_KEYS.filter((stat) => bonus[stat])
    .map((stat) => `${bonus[stat]! > 0 ? "+" : ""}${formatStatValue(stat, bonus[stat]!)} ${STAT_LABEL[stat]}`)
    .join(", ");
}

const pct = (ratio: number) => `${Math.round(ratio * 100)} %`;
const mag = (tag: RaidEffectTag, bonus: boolean) => RAID_MAGNITUDE[tag][bonus ? "bonus" : "base"];
/** "30 % (45 % avec la classe assortie)" from RAID_MAGNITUDE, so labels never drift from the engine. */
const both = (tag: RaidEffectTag, fmt: (m: number) => string) =>
  `${fmt(mag(tag, false))} (${fmt(mag(tag, true))} avec la classe assortie)`;

export const RAID_EFFECT_LABEL: Record<RaidEffectTag, string> = {
  cleave: `Éclaboussure : ${both("cleave", pct)} des dégâts sur un second ennemi`,
  execute: `Dégâts ×${both("execute", (m) => String(m).replace(".", ","))} contre une cible sous ${pct(EXECUTE_THRESHOLD)} PV`,
  pierce: `Ignore ${both("pierce", pct)} de la défense adverse`,
  stun: "Étourdit la cible touchée : elle perd sa prochaine action",
  lifesteal: `Vol de vie : rend ${both("lifesteal", pct)} des dégâts infligés`,
  poison: `Dégâts +${both("poison", (m) => pct(m - 1))} (poison)`,
  shield: `Réduit de ${both("shield", pct)} le prochain coup subi`,
  heal: "Soin renforcé sur l'allié le plus faible, au lieu d'attaquer (Soigneurs uniquement)",
  disarm: `Désamorçage : réduit les dégâts de pièges de toute l'équipe de ${both("disarm", pct)}`,
  scout: "Éclaireur : révèle le contenu des salles voisines (et leur nombre d'occupants avec la classe assortie)",
};

/** What a spell's raid effect does for THIS hero, with its actual attack — e.g. "coups de 42 dégâts,
 *  ignore 70 % de la défense". Numbers are before the target's defense (half of it is subtracted). */
export function describeRaidSpellValue(tag: RaidEffectTag, bonus: boolean, stats: HeroStats, role?: Role): string {
  const { value: atk, type } = attackPower(stats);
  const m = mag(tag, bonus);
  const hit = `coups de ${atk} ${type === "phys" ? "phys." : "mag."}`;
  switch (tag) {
    case "cleave": return `${hit} + ${Math.round(atk * m)} sur un second ennemi`;
    case "execute": return `${hit}, ${Math.round(atk * m)} sur une cible sous ${pct(EXECUTE_THRESHOLD)} PV`;
    case "pierce": return `${hit}, ignore ${pct(m)} de la défense`;
    case "stun": return `${hit}, la cible perd sa prochaine action`;
    case "lifesteal": return `${hit}, rend ${pct(m)} des dégâts en PV`;
    case "poison": return `coups de ${Math.round(atk * m)} ${type === "phys" ? "phys." : "mag."} (×${String(m).replace(".", ",")})`;
    case "shield": return `${hit}, −${pct(m)} sur le prochain coup reçu`;
    case "heal":
      return role === "HEAL"
        ? `soigne ${raidHealAmount(atk, m)} PV par tour au lieu d'attaquer`
        : `sans effet hors Soigneur : ${hit} simples`;
    case "disarm": return `−${pct(m)} de dégâts de pièges pour l'équipe`;
    case "scout": return bonus ? "révèle les salles voisines et leur nombre d'occupants" : "révèle les salles voisines";
  }
}

/** Arena labels come straight from the arena engine's spell table, so the hero screens always
 *  describe what the spell actually does in expeditions. */
export const ARENA_EFFECT_LABEL = Object.fromEntries(
  (Object.entries(ARENA_SPELL_TAGS) as [ArenaAbilityTag, (typeof ARENA_SPELL_TAGS)[ArenaAbilityTag]][]).map(([tag, def]) => [
    tag,
    `Arène : ${def.label} — ${def.description.charAt(0).toLowerCase()}${def.description.slice(1)} (toutes les ${String(def.cooldown).replace(".", ",")}s)`,
  ]),
) as Record<ArenaAbilityTag, string>;

export const ITEM_SLOT_LABEL: Record<ItemSlot, string> = {
  weapon: "Arme",
  armor: "Armure",
  trinket: "Babiole",
};
