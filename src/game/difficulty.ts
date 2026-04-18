/**
 * @module game/difficulty
 *
 * Difficulty model inspired by DOOM's tier ladder, reskinned for the circus.
 * Six tiers in a 3×2 selector:
 *
 *     ┌─────────────────────┬─────────────────────┐
 *     │ I'M TOO SILLY        │ KAZOO IT YOURSELF   │  (easy / medium)
 *     ├─────────────────────┼─────────────────────┤
 *     │ HONK ME PLENTY       │ ULTRA HONK          │  (hard / very-hard)
 *     ├─────────────────────┼─────────────────────┤
 *     │ NIGHTMARE MIDWAY     │ ULTRA NIGHTMARE     │  (nightmare / ultra)
 *     └─────────────────────┴─────────────────────┘
 *
 * Permadeath toggle:
 *   - Available only on `nightmare` and `ultra-nightmare`
 *   - Locked ON for `ultra-nightmare` (cannot be disabled)
 *   - When permadeath is ON: ANY collision ends the run instantly
 *   - Runs completed with permadeath grant bonus tickets + exclusive unlocks
 *
 * Numeric gameplay values (targetSpeedMps, sanityDrainMultiplier, rewardMultiplier)
 * live in tunables.json under the `difficulty` key so they can be tuned without
 * code changes.
 */
import { tunables } from '@/config';

export type Difficulty =
  | 'silly'
  | 'kazoo'
  | 'plenty'
  | 'ultra-honk'
  | 'nightmare'
  | 'ultra-nightmare';

export interface DifficultyProfile {
  id: Difficulty;
  /** Display label for the tile. */
  label: string;
  /** Subtitle (one-liner tone). */
  tagline: string;
  /** Starting target speed (m/s). From tunables.difficulty. */
  targetSpeedMps: number;
  /** Multiplier applied to per-hit sanity drain. From tunables.difficulty. */
  sanityDrainMultiplier: number;
  /** Multiplier applied to end-of-run ticket payout. From tunables.difficulty. */
  rewardMultiplier: number;
  /** Hue used for the difficulty tile's accent band. */
  accentHue: 'yellow' | 'blue' | 'orange' | 'purple' | 'red' | 'green';
  /** Can the player toggle permadeath on this tier? */
  supportsPermadeath: boolean;
  /** Does this tier FORCE permadeath on? */
  forcesPermadeath: boolean;
}

const d = tunables.difficulty;

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  silly: {
    id: 'silly',
    label: "I'M TOO SILLY",
    tagline: 'Honks like practice.',
    targetSpeedMps: d.silly.targetSpeedMps,
    sanityDrainMultiplier: d.silly.sanityDrainMultiplier,
    rewardMultiplier: d.silly.rewardMultiplier,
    accentHue: 'green',
    supportsPermadeath: false,
    forcesPermadeath: false,
  },
  kazoo: {
    id: 'kazoo',
    label: 'KAZOO IT YOURSELF',
    tagline: 'The house recipe.',
    targetSpeedMps: d.kazoo.targetSpeedMps,
    sanityDrainMultiplier: d.kazoo.sanityDrainMultiplier,
    rewardMultiplier: d.kazoo.rewardMultiplier,
    accentHue: 'blue',
    supportsPermadeath: false,
    forcesPermadeath: false,
  },
  plenty: {
    id: 'plenty',
    label: 'HONK ME PLENTY',
    tagline: 'Louder. Faster. Pay attention.',
    targetSpeedMps: d.plenty.targetSpeedMps,
    sanityDrainMultiplier: d.plenty.sanityDrainMultiplier,
    rewardMultiplier: d.plenty.rewardMultiplier,
    accentHue: 'yellow',
    supportsPermadeath: false,
    forcesPermadeath: false,
  },
  'ultra-honk': {
    id: 'ultra-honk',
    label: 'ULTRA HONK',
    tagline: 'The crowd will not forgive a drift.',
    targetSpeedMps: d.ultraHonk.targetSpeedMps,
    sanityDrainMultiplier: d.ultraHonk.sanityDrainMultiplier,
    rewardMultiplier: d.ultraHonk.rewardMultiplier,
    accentHue: 'orange',
    supportsPermadeath: false,
    forcesPermadeath: false,
  },
  nightmare: {
    id: 'nightmare',
    label: 'NIGHTMARE MIDWAY',
    tagline: 'Permadeath optional. Regret mandatory.',
    targetSpeedMps: d.nightmare.targetSpeedMps,
    sanityDrainMultiplier: d.nightmare.sanityDrainMultiplier,
    rewardMultiplier: d.nightmare.rewardMultiplier,
    accentHue: 'purple',
    supportsPermadeath: true,
    forcesPermadeath: false,
  },
  'ultra-nightmare': {
    id: 'ultra-nightmare',
    label: 'ULTRA NIGHTMARE',
    tagline: 'Any collision = end of run. No toggles. No mercy.',
    targetSpeedMps: d.ultraNightmare.targetSpeedMps,
    sanityDrainMultiplier: d.ultraNightmare.sanityDrainMultiplier,
    rewardMultiplier: d.ultraNightmare.rewardMultiplier,
    accentHue: 'red',
    supportsPermadeath: true,
    forcesPermadeath: true,
  },
};

export const DEFAULT_DIFFICULTY: Difficulty = 'kazoo';

/**
 * Grid layout used by the NewRun modal. 3 rows × 2 cols — left=easier half,
 * right=harder half. Bottom row is the nightmare tier with permadeath toggle.
 */
export const DIFFICULTY_GRID: Difficulty[][] = [
  ['silly', 'kazoo'],
  ['plenty', 'ultra-honk'],
  ['nightmare', 'ultra-nightmare'],
];

/**
 * Does the run effectively run in permadeath mode?
 * ultra-nightmare FORCES it on; nightmare respects the user toggle; all
 * other tiers always return false.
 */
export function effectivePermadeath(difficulty: Difficulty, toggleOn: boolean): boolean {
  const profile = DIFFICULTY_PROFILES[difficulty];
  if (profile.forcesPermadeath) return true;
  if (profile.supportsPermadeath) return toggleOn;
  return false;
}
