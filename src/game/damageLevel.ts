/**
 * Maps the player's sanity value to a discrete damage level (0–3).
 *
 * Level 0  sanity > 70      pristine — no visible damage
 * Level 1  40 < sanity ≤ 70 dented   — slight wheel wobble, soot smudge
 * Level 2  15 < sanity ≤ 40 bad      — tilted hood look, smoke particles
 * Level 3  sanity ≤ 15      critical — sparks, strong wheel wobble, 2× shake
 */
export function damageLevelFor(sanity: number): 0 | 1 | 2 | 3 {
  if (sanity > 70) return 0;
  if (sanity > 40) return 1;
  if (sanity > 15) return 2;
  return 3;
}
