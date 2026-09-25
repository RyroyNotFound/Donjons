import { equippedItemsOf, heroPower, resolveHeroStats } from "@/lib/game/engine/stats";
import { itemTotalStats } from "@/lib/game/engine/items";
import { getTalentsForClass } from "@/lib/game/content/talents";
import { MASTERIES, getMastery } from "@/lib/game/content/masteries";
import { SPELLS } from "@/lib/game/content/spells";
import { levelCapForStar, MASTERY_SLOTS, MAX_STAR_RANK, rankUpCost, SPELL_SLOTS } from "@/lib/game/economy";
import type { Hero, HeroStats, Item, ItemSlot, TalentNode, UserProfile } from "@/types/game";

// What each hero-screen choice is actually worth: the power gained by equipping an item or a
// mastery or by putting a point into a talent (heroPower on the resolved stats, before vs after),
// plus the parts of a bonus that do nothing for this hero (the attack type it doesn't fight with).
// Feeds the "▲ +N" badges and the overview's "À améliorer" list.

export interface Impact {
  /** heroPower after − before. */
  delta: number;
  /** Bonus parts wasted on this hero, e.g. "+8 ATQ mag.". */
  wasted: string[];
  /** The bonus carries trap resistance: worth something in raids even at delta 0. */
  trapRes: boolean;
}

export interface HeroContext {
  hero: Hero;
  items: Item[];
  ranks: Record<string, number>;
}

export function powerOf({ hero, items, ranks }: HeroContext): number {
  return heroPower(resolveHeroStats(hero, equippedItemsOf(hero, items), ranks));
}

export function statsOf({ hero, items, ranks }: HeroContext): HeroStats {
  return resolveHeroStats(hero, equippedItemsOf(hero, items), ranks);
}

/** "+8 ATQ mag." parts of `bonus` that target the attack type the hero does NOT fight with (after the change). */
export function wastedParts(bonus: Partial<HeroStats>, after: HeroStats): string[] {
  const magic = after.atkMag > after.atkPhys;
  const out: string[] = [];
  if (!magic && (bonus.atkMag ?? 0) > 0) out.push(`+${Math.round(bonus.atkMag!)} ATQ mag.`);
  if (magic && (bonus.atkPhys ?? 0) > 0) out.push(`+${Math.round(bonus.atkPhys!)} ATQ phys.`);
  return out;
}

function impact(ctx: HeroContext, changed: Hero, bonus: Partial<HeroStats>): Impact {
  const before = powerOf(ctx);
  const afterStats = resolveHeroStats(changed, equippedItemsOf(changed, ctx.items), ctx.ranks);
  return {
    delta: heroPower(afterStats) - before,
    wasted: wastedParts(bonus, afterStats),
    trapRes: (bonus.trapRes ?? 0) > 0,
  };
}

/** Equipping `item` in its slot (replacing whatever is there). */
export function itemImpact(ctx: HeroContext, item: Item): Impact {
  const changed = { ...ctx.hero, equipment: { ...ctx.hero.equipment, [item.slot]: item.id } };
  return impact(ctx, changed, itemTotalStats(item));
}

/** Adding mastery `id` (or, when already equipped, what it brings: removing it vs keeping it). */
export function masteryImpact(ctx: HeroContext, id: string): Impact {
  const equipped = ctx.hero.equippedMasteryIds.includes(id);
  const bonus = getMastery(id).statBonus;
  if (equipped) {
    const without = { ...ctx.hero, equippedMasteryIds: ctx.hero.equippedMasteryIds.filter((m) => m !== id) };
    return impact({ ...ctx, hero: without }, ctx.hero, bonus);
  }
  return impact(ctx, { ...ctx.hero, equippedMasteryIds: [...ctx.hero.equippedMasteryIds, id] }, bonus);
}

/** One more point in talent `node`. */
export function talentImpact(ctx: HeroContext, node: TalentNode): Impact {
  const changed = { ...ctx.hero, talents: { ...ctx.hero.talents, [node.id]: (ctx.hero.talents[node.id] ?? 0) + 1 } };
  return impact(ctx, changed, node.statBonusPerRank);
}

/** Items the hero may put in `slot`: free ones plus its own. */
export function itemsForSlot(ctx: HeroContext, slot: ItemSlot): Item[] {
  return ctx.items.filter((i) => i.slot === slot && (!i.equippedByHeroId || i.equippedByHeroId === ctx.hero.id));
}

/** Can a point go into this talent right now? */
export function talentSpendable(hero: Hero, ranks: Record<string, number>, node: TalentNode): boolean {
  return (
    (ranks[node.id] ?? 0) > 0 &&
    (hero.talents[node.id] ?? 0) < node.maxRank &&
    (!node.requiresStarRank || (hero.starRank ?? 1) >= node.requiresStarRank) &&
    hero.talentPoints >= node.cost
  );
}

export type HeroTab = "apercu" | "equipement" | "sorts" | "maitrises" | "talents" | "ensembles";

export interface HeroTodo {
  tone: "warn" | "bad" | "info";
  text: string;
  tab: HeroTab;
}

const SLOT_NAME: Record<ItemSlot, string> = { weapon: "Arme", armor: "Armure", trinket: "Babiole" };

/** The overview's "À améliorer" list, most useful first. */
export function heroTodos(ctx: HeroContext, profile: Pick<UserProfile, "rankTokens" | "gold">): HeroTodo[] {
  const { hero, items, ranks } = ctx;
  const todos: HeroTodo[] = [];
  if (!hero.classId) return [{ tone: "bad", text: "Sans classe : ce héros est très faible. Choisissez une classe.", tab: "apercu" }];
  const stats = statsOf(ctx);

  // Talent points.
  if (hero.talentPoints > 0) {
    const tree = getTalentsForClass(hero.classId);
    const spendable = tree.filter((n) => talentSpendable(hero, ranks, n));
    if (spendable.length > 0) {
      const best = Math.max(...spendable.map((n) => talentImpact(ctx, n).delta));
      todos.push({ tone: "warn", text: `${hero.talentPoints} point${hero.talentPoints > 1 ? "s" : ""} de talent à dépenser (jusqu'à ▲ +${best} par point)`, tab: "talents" });
    } else {
      const locked = tree.filter((n) => (ranks[n.id] ?? 0) <= 0).length;
      todos.push({
        tone: "info",
        text: `${hero.talentPoints} point${hero.talentPoints > 1 ? "s" : ""} de talent en réserve : ${locked > 0 ? `${locked} talent${locked > 1 ? "s" : ""} de cette classe restent à obtenir (invocation / Observatoire)` : "tous les talents disponibles sont au maximum"}`,
        tab: "talents",
      });
    }
  }

  // Equipment: empty slots and better free items.
  for (const slot of ["weapon", "armor", "trinket"] as ItemSlot[]) {
    const current = hero.equipment[slot];
    const candidates = itemsForSlot(ctx, slot).filter((i) => i.id !== current);
    let best: { item: Item; delta: number } | undefined;
    for (const item of candidates) {
      const d = itemImpact(ctx, item).delta;
      if (!best || d > best.delta) best = { item, delta: d };
    }
    if (!current) {
      todos.push(
        best && best.delta > 0
          ? { tone: "bad", text: `${SLOT_NAME[slot]} vide — meilleur choix : ${best.item.name} (▲ +${best.delta})`, tab: "equipement" }
          : { tone: "info", text: `${SLOT_NAME[slot]} vide — aucun objet disponible (forge ou expéditions)`, tab: "equipement" },
      );
    } else if (best && best.delta > 0) {
      todos.push({ tone: "warn", text: `${SLOT_NAME[slot]} : ${best.item.name} serait meilleur (▲ +${best.delta})`, tab: "equipement" });
    }
  }

  // Spells.
  const ownedSpells = SPELLS.filter((s) => (ranks[s.id] ?? 0) > 0);
  if (hero.equippedSpellIds.length < SPELL_SLOTS && ownedSpells.length > hero.equippedSpellIds.length) {
    todos.push({
      tone: hero.equippedSpellIds.length === 0 ? "bad" : "warn",
      text: `${SPELL_SLOTS - hero.equippedSpellIds.length} emplacement${SPELL_SLOTS - hero.equippedSpellIds.length > 1 ? "s" : ""} de sort vide${SPELL_SLOTS - hero.equippedSpellIds.length > 1 ? "s" : ""} (chaque sort ajoute une attaque en expédition)`,
      tab: "sorts",
    });
  }

  // Masteries: empty slots, useless ones.
  const freeMasterySlots = MASTERY_SLOTS - hero.equippedMasteryIds.length;
  if (freeMasterySlots > 0) {
    const candidates = MASTERIES.filter((m) => (ranks[m.id] ?? 0) > 0 && !hero.equippedMasteryIds.includes(m.id));
    if (candidates.length > 0) {
      const best = candidates.map((m) => ({ m, d: masteryImpact(ctx, m.id).delta })).sort((a, b) => b.d - a.d)[0];
      todos.push({
        tone: "warn",
        text: `${freeMasterySlots} emplacement${freeMasterySlots > 1 ? "s" : ""} de maîtrise vide${freeMasterySlots > 1 ? "s" : ""}${best.d > 0 ? ` — meilleur choix : ${best.m.name} (▲ +${best.d})` : ""}`,
        tab: "maitrises",
      });
    }
  }

  // Wasted attack from the current gear/masteries.
  const wastedSources: string[] = [];
  for (const id of hero.equippedMasteryIds) {
    const w = wastedParts(getMastery(id).statBonus, stats);
    if (w.length) wastedSources.push(`${getMastery(id).name} (${w.join(", ")})`);
  }
  for (const item of equippedItemsOf(hero, items)) {
    const w = wastedParts(itemTotalStats(item), stats);
    if (w.length) wastedSources.push(`${item.name} (${w.join(", ")})`);
  }
  if (wastedSources.length > 0) {
    todos.push({
      tone: "bad",
      text: `Inutile pour un héros ${stats.atkMag > stats.atkPhys ? "magique" : "physique"} : ${wastedSources.join(" · ")}`,
      tab: wastedSources.some((s) => MASTERIES.some((m) => s.startsWith(m.name))) ? "maitrises" : "equipement",
    });
  }

  // Stars.
  const star = hero.starRank ?? 1;
  if (star < MAX_STAR_RANK) {
    const cost = rankUpCost(star);
    const affordable = profile.rankTokens >= cost.rankTokens && profile.gold >= cost.gold;
    if (hero.level >= levelCapForStar(star)) {
      todos.push({ tone: "bad", text: `Niveau maximum pour ${star}★ : il ne gagne plus d'XP avant une ascension`, tab: "apercu" });
    } else if (affordable) {
      todos.push({ tone: "info", text: `Ascension possible (${cost.rankTokens} jetons + ${cost.gold} or) : +8 % de stats et niveau max relevé`, tab: "apercu" });
    }
  }

  return todos;
}
