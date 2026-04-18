/**
 * Maps the player's sanity value to a discrete damage level (0–3).
 *
 * Level 0  sanity > 70      pristine — no visible damage
 * Level 1  40 < sanity ≤ 70 dented   — slight wheel wobble, soot smudge
 * Level 2  15 < sanity ≤ 40 bad      — tilted hood look, smoke particles
 * Level 3  sanity ≤ 15      critical — sparks, strong wheel wobble, 2× shake
 */
import { tunables } from '@/config';

export function damageLevelFor(sanity: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(sanity) || sanity < 0) {
    throw new Error(`Invalid sanity value: ${sanity}. Expected a finite non-negative number.`);
  }
  const { pristineThreshold, dentedThreshold, badThreshold } = tunables.damage;
  if (sanity > pristineThreshold) return 0;
  if (sanity > dentedThreshold) return 1;
  if (sanity > badThreshold) return 2;
  return 3;
}
