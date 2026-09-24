export const PLAYER_NAME_MIN = 3;
export const PLAYER_NAME_MAX = 16;

/** Letters (accents included), digits, and single spaces / _ / - / ' between them. */
const PLAYER_NAME_PATTERN = /^[\p{L}\p{N}]+(?:[ _'-][\p{L}\p{N}]+)*$/u;

/** Trims and collapses runs of whitespace — what actually gets stored. */
export function cleanPlayerName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Returns an error message, or null if the (already cleaned) name is acceptable. Shared by the form and the API. */
export function playerNameError(name: string): string | null {
  if (name.length < PLAYER_NAME_MIN) return `Au moins ${PLAYER_NAME_MIN} caractères.`;
  if (name.length > PLAYER_NAME_MAX) return `${PLAYER_NAME_MAX} caractères maximum.`;
  if (!PLAYER_NAME_PATTERN.test(name)) {
    return "Lettres, chiffres, et espace / tiret / apostrophe / _ entre deux mots uniquement.";
  }
  return null;
}

/** Uniqueness key: case- and accent-insensitive, so « Élise » and « elise » can't coexist. */
export function playerNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export const HERO_NAME_MIN = 2;
export const HERO_NAME_MAX = 20;

/** Same character rules as player names, but not unique and a bit longer. Shared by the form and the API. */
export function heroNameError(name: string): string | null {
  if (name.length < HERO_NAME_MIN) return `Au moins ${HERO_NAME_MIN} caractères.`;
  if (name.length > HERO_NAME_MAX) return `${HERO_NAME_MAX} caractères maximum.`;
  if (!PLAYER_NAME_PATTERN.test(name)) {
    return "Lettres, chiffres, et espace / tiret / apostrophe / _ entre deux mots uniquement.";
  }
  return null;
}
