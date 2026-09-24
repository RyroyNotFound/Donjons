import type { Role } from "@/types/game";

/** One 4-frame idle sheet per role, reused across classes via CSS tint below. */
export const HERO_SPRITE_BY_ROLE: Record<Role, string> = {
  DPS: "/sprites/heroes/dps.png",
  HEAL: "/sprites/heroes/heal.png",
  TANK: "/sprites/heroes/tank.png",
};

/** CSS `filter` per class, so the two classes sharing a role stay visually distinct. */
export const CLASS_TINT: Record<string, string> = {
  guerrier: "none",
  archer: "hue-rotate(75deg) saturate(1.3)",
  pretre: "hue-rotate(200deg) brightness(1.25) saturate(0.8)",
  druide: "hue-rotate(70deg) saturate(1.2)",
  paladin: "hue-rotate(35deg) saturate(1.3) brightness(1.1)",
  colosse: "grayscale(0.5) brightness(0.85)",
};
