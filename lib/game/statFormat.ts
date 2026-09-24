import type { ArenaAbilityTag, HeroStats, RaidEffectTag } from "@/types/game";

const STAT_LABEL: Record<keyof HeroStats, string> = {
  hp: "PV",
  atkPhys: "ATQ phys.",
  atkMag: "ATQ mag.",
  defPhys: "DEF phys.",
  defMag: "DEF mag.",
  spd: "VIT",
};
const STAT_ORDER: (keyof HeroStats)[] = ["hp", "atkPhys", "atkMag", "defPhys", "defMag", "spd"];

/** Renders a partial stat bonus as "+12 PV, +3 ATQ" — the actual numbers, not a vague "flat bonus" label. */
export function formatStatBonus(bonus: Partial<HeroStats>): string {
  return STAT_ORDER.filter((stat) => bonus[stat]).map((stat) => `+${bonus[stat]} ${STAT_LABEL[stat]}`).join(", ");
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
};

export const ARENA_EFFECT_LABEL: Record<ArenaAbilityTag, string> = {
  cleave: "Arène : frappe de zone",
  multishot: "Arène : projectile supplémentaire",
  regen: "Arène : régénération passive",
  haste: "Arène : cadence d'attaque accrue",
  dmgbuff: "Arène : bonus de dégâts d'équipe",
  lifesteal: "Arène : vol de vie",
};
