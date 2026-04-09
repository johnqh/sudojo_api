/**
 * @fileoverview Localization helpers for computing i18n string keys.
 *
 * These functions attach `localization` data to API response objects so clients
 * can resolve translated text from their locale files using the string key,
 * with the raw English text as a fallback.
 */

import type { LocalizedHint } from "@sudobility/sudojo_types";

/** Build a LocalizedHint with no interpolation values */
function loc(stringKey: string): LocalizedHint {
  return { stringKey, values: [] };
}

/** Localization for a Level entity */
export function levelLocalization(levelNumber: number) {
  return {
    title: loc(`levels.${levelNumber}.title`),
    text: loc(`levels.${levelNumber}.text`),
  };
}

/** Localization for a Technique entity */
export function techniqueLocalization(path: string | null) {
  if (!path) return undefined;
  return {
    title: loc(`techniques.${path}.title`),
    text: loc(`techniques.${path}.overview`),
  };
}

/** Localization for a BadgeDefinition / EarnedBadge / NewBadge */
export function badgeLocalization(badgeKey: string) {
  return {
    title: loc(`badges.${badgeKey}.title`),
    description: loc(`badges.${badgeKey}.description`),
  };
}

/** Localization for a technique title (used in practice counts) */
export function techniqueTitleLocalization(path: string | null) {
  if (!path) return undefined;
  return {
    title: loc(`techniques.${path}.title`),
  };
}

/** Localization for a learning content entry */
export function learningLocalization(
  techniquePath: string | null,
  index: number
) {
  if (!techniquePath) return undefined;
  return {
    text: loc(`learning.${techniquePath}.${index}`),
  };
}

/** Localization for a hint step title (technique name) */
export function hintTitleLocalization(
  techniquePath: string | null
): LocalizedHint | undefined {
  if (!techniquePath) return undefined;
  return loc(`techniques.${techniquePath}.title`);
}
