import { MAX_ROUNDS, WEAKEN_PER_STACK } from "@/lib/game/engine/dungeonCombat";
import type { RaidBattleReport, RaidBattleUnitReport } from "@/types/game";

// Turns a room fight's report (see resolveRoomBattle) into a few plain sentences that explain
// why it was won or lost: the damage race, what the defense soaked, who carried the fight.

export interface BattleInsight {
  tone: "good" | "bad" | "neutral";
  text: string;
}

const sum = (units: RaidBattleUnitReport[], pick: (u: RaidBattleUnitReport) => number) =>
  units.reduce((s, u) => s + pick(u), 0);

const pct = (ratio: number) => `${Math.round(ratio * 100)} %`;

function avg(units: RaidBattleUnitReport[], pick: (u: RaidBattleUnitReport) => number): number {
  return units.length ? Math.round(sum(units, pick) / units.length) : 0;
}

/** Rounds a side needs to chew through the other's HP at its average pace (Infinity if it deals nothing). */
function roundsToKill(dealtPerRound: number, hp: number): number {
  return dealtPerRound > 0 ? Math.ceil(hp / dealtPerRound) : Infinity;
}

function roundsLabel(n: number, never: string): string {
  return Number.isFinite(n) ? `≈ ${n} tour${n > 1 ? "s" : ""}` : never;
}

export function explainBattle(report: RaidBattleReport): BattleInsight[] {
  const heroes = report.units.filter((u) => u.side === "hero");
  const enemies = report.units.filter((u) => u.side === "enemy");
  const rounds = Math.max(1, report.rounds);
  const insights: BattleInsight[] = [];

  const heroDpr = Math.round(sum(heroes, (u) => u.dealt) / rounds);
  const enemyDpr = Math.round(sum(enemies, (u) => u.dealt) / rounds);
  const heroHeal = Math.round(sum(heroes, (u) => u.healed) / rounds);
  const enemyHp = sum(enemies, (u) => u.hpStart);
  const heroHp = sum(heroes, (u) => u.hpStart);
  const toKillThem = roundsToKill(heroDpr, enemyHp);
  const toKillUs = roundsToKill(Math.max(0, enemyDpr - heroHeal), heroHp);

  insights.push({
    tone: report.outcome === "cleared" ? "good" : "bad",
    text:
      `Course aux dégâts : vos héros infligeaient ~${heroDpr} dégâts/tour face à ${enemyHp} PV ennemis (${roundsLabel(toKillThem, "impossible")}), ` +
      `les ennemis ~${enemyDpr}/tour face à vos ${heroHp} PV${heroHeal > 0 ? ` (−${heroHeal} soignés/tour)` : ""} (${roundsLabel(toKillUs, "vos soins compensaient tout")}).`,
  });

  if (report.timedOut) {
    insights.push({
      tone: "bad",
      text: `Au-delà de ${MAX_ROUNDS} tours, le combat est perdu d'office : il faut plus de dégâts pour finir la salle à temps.`,
    });
  }

  // What defense soaked, both ways.
  const heroRaw = sum(heroes, (u) => u.rawDealt);
  const heroLost = sum(heroes, (u) => u.lostToDefense);
  if (heroRaw > 0 && heroLost / heroRaw >= 0.3) {
    const physHeroes = heroes.filter((u) => u.atkType === "phys" && u.hits > 0).length;
    const magHeroes = heroes.filter((u) => u.atkType === "mag" && u.hits > 0).length;
    const defPhys = avg(enemies, (u) => u.defPhys);
    const defMag = avg(enemies, (u) => u.defMag);
    let tip = "un sort Perce-défense ou plus d'attaque aideraient.";
    if (physHeroes >= magHeroes && defMag < defPhys * 0.7) tip = `leur DEF mag. est plus faible (${defMag} contre ${defPhys} en phys.) : des attaquants magiques passeraient mieux.`;
    else if (magHeroes > physHeroes && defPhys < defMag * 0.7) tip = `leur DEF phys. est plus faible (${defPhys} contre ${defMag} en mag.) : des attaquants physiques passeraient mieux.`;
    insights.push({ tone: "bad", text: `La défense ennemie absorbait ${pct(heroLost / heroRaw)} de vos coups — ${tip}` });
  }
  const enemyRaw = sum(enemies, (u) => u.rawDealt);
  const enemyLost = sum(enemies, (u) => u.lostToDefense);
  if (enemyRaw > 0 && enemyLost / enemyRaw >= 0.3) {
    insights.push({ tone: "good", text: `Votre défense absorbait ${pct(enemyLost / enemyRaw)} des coups ennemis.` });
  }

  const weakened = heroes.filter((u) => u.weakened);
  if (weakened.length > 0) {
    insights.push({
      tone: "bad",
      text: `${weakened.map((u) => `${u.name} (×${u.weakened})`).join(", ")} combattai${weakened.length > 1 ? "ent" : "t"} affaibli${weakened.length > 1 ? "s" : ""} par les pièges : −${pct(WEAKEN_PER_STACK)} de dégâts et +${pct(WEAKEN_PER_STACK)} subis par cumul.`,
    });
  }

  // Standouts on each side.
  const topHero = [...heroes].sort((a, b) => b.dealt - a.dealt)[0];
  const topEnemy = [...enemies].sort((a, b) => b.dealt - a.dealt)[0];
  if (topEnemy && topEnemy.dealt > 0 && report.outcome === "wiped") {
    insights.push({
      tone: "bad",
      text: `Menace principale : ${topEnemy.name} (${topEnemy.dealt} dégâts, ATQ ${topEnemy.atk} ${topEnemy.atkType === "phys" ? "phys." : "mag."}).`,
    });
  }
  if (topHero && topHero.dealt > 0) {
    insights.push({ tone: "neutral", text: `Meilleur attaquant : ${topHero.name} (${topHero.dealt} dégâts en ${topHero.hits} coups${topHero.crits ? `, ${topHero.crits} critique${topHero.crits > 1 ? "s" : ""}` : ""}).` });
  }
  const noHealer = heroes.every((u) => u.healed === 0);
  if (report.outcome === "wiped" && noHealer && rounds >= 3) {
    insights.push({ tone: "neutral", text: "Aucun soin pendant le combat : un soigneur (sort Soin renforcé) prolonge les combats longs." });
  }

  return insights;
}
