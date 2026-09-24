import type { ExpeditionRecord, ZoneDefinition } from "@/types/game";

// Expedition ladder: each zone unlocks once the previous one is cleared (≥1★). Runs stay short
// (≤ 60s) and end with a boss ~20s before the timer. Monster ids come from lib/game/content/dungeon.ts
// (stats + sprite); their arena behavior (swarm/brute/ranged) is in lib/game/arena/engine.ts.
export const ZONES: ZoneDefinition[] = [
  {
    id: "foret-lisiere",
    name: "Lisière de la forêt",
    description: "Des bandes d'orcs rôdent entre les arbres. Idéal pour débuter.",
    tier: 1,
    difficulty: 10,
    recommendedPower: 40,
    heroSlots: 2,
    durationSec: 45,
    monsterPool: ["gobelin-eclaireur"],
    statScale: 0.6,
    spawnIntervalSec: 3,
    baseWaveSize: 3,
    eliteEveryNWaves: 4,
    boss: { refId: "gobelin-eclaireur", name: "Chef orc", hpMultiplier: 14, atkMultiplier: 1.6, spawnAtSec: 28 },
    hazard: { name: "Flèches des éclaireurs", damagePct: 0.2, intervalSec: 2.5 },
    xpReward: 40,
    theme: { inner: "#20301f", outer: "#0b100c" },
    loot: {
      goldMin: 20,
      goldMax: 45,
      resourceDrops: { wood: [3, 8] },
      itemDropChance: 0.2,
      monsterCaptureChance: 0.1,
      monsterCaptureRefId: "gobelin-eclaireur",
    },
  },
  {
    id: "mines-abandonnees",
    name: "Mines abandonnées",
    description: "Riches en minerai, gardées par des golems d'ossements lents mais coriaces.",
    tier: 2,
    unlockRequires: "foret-lisiere",
    difficulty: 25,
    recommendedPower: 110,
    heroSlots: 3,
    durationSec: 50,
    monsterPool: ["gobelin-eclaireur", "golem-de-pierre"],
    statScale: 0.8,
    spawnIntervalSec: 3,
    baseWaveSize: 3,
    eliteEveryNWaves: 3,
    boss: { refId: "golem-de-pierre", name: "Golem ancien", hpMultiplier: 7, atkMultiplier: 1.8, spawnAtSec: 32 },
    hazard: { name: "Éboulements", damagePct: 0.2, intervalSec: 2.5 },
    xpReward: 70,
    theme: { inner: "#2a2622", outer: "#0d0b0a" },
    loot: {
      goldMin: 40,
      goldMax: 90,
      resourceDrops: { ore: [5, 11] },
      itemDropChance: 0.28,
      monsterCaptureChance: 0.12,
      monsterCaptureRefId: "golem-de-pierre",
    },
  },
  {
    id: "ruines-oubliees",
    name: "Ruines oubliées",
    description: "Des chamans orcs y lancent la foudre depuis les décombres chargés d'essence.",
    tier: 3,
    unlockRequires: "mines-abandonnees",
    difficulty: 45,
    recommendedPower: 220,
    heroSlots: 3,
    durationSec: 55,
    monsterPool: ["araignee-venimeuse", "gobelin-eclaireur", "golem-de-pierre"],
    statScale: 1,
    spawnIntervalSec: 2.5,
    baseWaveSize: 4,
    eliteEveryNWaves: 3,
    boss: { refId: "araignee-venimeuse", name: "Grande chamane", hpMultiplier: 9, atkMultiplier: 2, spawnAtSec: 36 },
    // The Nécropole has none: its monsters already overrun a party that stands still.
    hazard: { name: "Foudre des chamans", damagePct: 0.08, intervalSec: 5 },
    xpReward: 110,
    theme: { inner: "#262032", outer: "#0c0a10" },
    loot: {
      goldMin: 80,
      goldMax: 160,
      resourceDrops: { essence: [3, 7], ore: [2, 5] },
      itemDropChance: 0.35,
      monsterCaptureChance: 0.1,
      monsterCaptureRefId: "araignee-venimeuse",
    },
  },
  {
    id: "necropole-maudite",
    name: "Nécropole maudite",
    description: "Le Seigneur des ombres y lève une armée sans fin. Réservé aux équipes aguerries.",
    tier: 4,
    unlockRequires: "ruines-oubliees",
    difficulty: 70,
    recommendedPower: 400,
    heroSlots: 4,
    durationSec: 60,
    monsterPool: ["araignee-venimeuse", "golem-de-pierre", "gobelin-eclaireur"],
    statScale: 1.4,
    spawnIntervalSec: 2.5,
    baseWaveSize: 5,
    eliteEveryNWaves: 2,
    boss: { refId: "seigneur-des-ombres", name: "Seigneur des ombres", hpMultiplier: 8, atkMultiplier: 1.6, spawnAtSec: 40 },
    xpReward: 160,
    theme: { inner: "#2b1a1a", outer: "#0e0707" },
    loot: {
      goldMin: 140,
      goldMax: 260,
      resourceDrops: { essence: [5, 10], ore: [4, 8], wood: [4, 8] },
      itemDropChance: 0.45,
      monsterCaptureChance: 0.06,
      monsterCaptureRefId: "seigneur-des-ombres",
    },
  },
];

export function getZone(id: string): ZoneDefinition {
  const zone = ZONES.find((z) => z.id === id);
  if (!zone) throw new Error(`Zone inconnue: ${id}`);
  return zone;
}

export function isZoneUnlocked(zone: ZoneDefinition, records: Record<string, ExpeditionRecord> | undefined): boolean {
  if (!zone.unlockRequires) return true;
  return (records?.[zone.unlockRequires]?.bestStars ?? 0) >= 1;
}
