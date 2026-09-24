import type { Role } from "@/types/game";

export const ROLE_TEXT_COLOR: Record<Role, string> = {
  DPS: "text-red-400",
  HEAL: "text-emerald-400",
  TANK: "text-sky-400",
};

export const ROLE_GRADIENT: Record<Role, string> = {
  DPS: "from-red-400 to-red-600",
  HEAL: "from-emerald-400 to-emerald-600",
  TANK: "from-sky-400 to-sky-600",
};

export const ROLE_GLOW: Record<Role, string> = {
  DPS: "shadow-[0_0_8px_rgba(248,113,113,0.5)]",
  HEAL: "shadow-[0_0_8px_rgba(52,211,153,0.5)]",
  TANK: "shadow-[0_0_8px_rgba(56,189,248,0.5)]",
};

/** Player-facing role names (the Role codes stay internal). */
export const ROLE_LABEL: Record<Role, string> = {
  DPS: "DPS",
  HEAL: "Soigneur",
  TANK: "Tank",
};
