import type { ZoneDefinition } from "@/types/game";

export const ZONES: ZoneDefinition[] = [
  {
    id: "foret-lisiere",
    name: "Lisière de la forêt",
    description: "Zone d'entraînement paisible, peu de risques.",
    difficulty: 10,
    heroSlots: 2,
    durationSec: 60 * 5,
    loot: {
      goldMin: 20,
      goldMax: 45,
      resourceDrops: { wood: [3, 8] },
      itemDropChance: 0.15,
    },
  },
  {
    id: "mines-abandonnees",
    name: "Mines abandonnées",
    description: "Riches en minerai, gardées par des créatures rocheuses.",
    difficulty: 25,
    heroSlots: 3,
    durationSec: 60 * 20,
    loot: {
      goldMin: 40,
      goldMax: 90,
      resourceDrops: { ore: [4, 10] },
      itemDropChance: 0.25,
      monsterCaptureChance: 0.1,
      monsterCaptureRefId: "golem-de-pierre",
    },
  },
  {
    id: "ruines-oubliees",
    name: "Ruines oubliées",
    description: "Vestiges anciens chargés d'essence magique et de dangers.",
    difficulty: 45,
    heroSlots: 3,
    durationSec: 60 * 60,
    loot: {
      goldMin: 80,
      goldMax: 160,
      resourceDrops: { essence: [2, 6], ore: [2, 5] },
      itemDropChance: 0.35,
      monsterCaptureChance: 0.08,
      monsterCaptureRefId: "araignee-venimeuse",
    },
  },
];

export function getZone(id: string): ZoneDefinition {
  const zone = ZONES.find((z) => z.id === id);
  if (!zone) throw new Error(`Zone inconnue: ${id}`);
  return zone;
}
