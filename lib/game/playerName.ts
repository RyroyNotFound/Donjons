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
