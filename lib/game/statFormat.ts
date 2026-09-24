import { ARENA_SPELL_TAGS } from "@/lib/game/arena/engine";
import { isPercentStat, STAT_KEYS } from "@/lib/game/engine/elements";
import type { ArenaAbilityTag, HeroStats, ItemSlot, RaidEffectTag } from "@/types/game";

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

export const RAID_EFFECT_LABEL: Record<RaidEffectTag, string> = {
  cleave: "Éclaboussure sur une cible proche",
  execute: "+50% dégâts contre une cible sous 30% PV",
  pierce: "Ignore la moitié de la défense adverse",
  stun: "Étourdit la cible touchée",
  lifesteal: "Vol de vie (40% des dégâts infligés)",
  poison: "+25% dégâts (poison)",
  shield: "Réduit de 30% les prochains dégâts subis",
  heal: "Soin renforcé sur l'allié le plus faible, au lieu d'attaquer",
  disarm: "Désamorçage : réduit les dégâts de pièges de toute l'équipe (-35 %, -50 % avec la classe assortie)",
  scout: "Éclaireur : révèle le contenu des salles voisines (et leur nombre d'occupants avec la classe assortie)",
};

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
