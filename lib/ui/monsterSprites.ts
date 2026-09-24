/** Idle sheet per monster id. Ids are stable (referenced by Firestore room/capture
    data) — only the display name/description changed when the sprites were picked. */
export const MONSTER_SPRITE: Record<string, string> = {
  "gobelin-eclaireur": "/sprites/monsters/gobelin-eclaireur.png",
  "golem-de-pierre": "/sprites/monsters/golem-de-pierre.png",
  "araignee-venimeuse": "/sprites/monsters/araignee-venimeuse.png",
  "seigneur-des-ombres": "/sprites/monsters/seigneur-des-ombres.png",
};
