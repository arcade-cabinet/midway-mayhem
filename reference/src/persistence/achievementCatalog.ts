/**
 * @module persistence/achievementCatalog
 *
 * Static catalog of all achievement definitions. Separated from the
 * grant/query logic in achievements.ts so both files stay under 300 LOC.
 */

// ─── Predicate type interfaces ───────────────────────────────────────────────

export interface RunAchievementStats {
  /** Distance travelled in metres */
  distance: number;
  /** Crowd reaction score */
  crowd: number;
  /** Crashes this run */
  crashes: number;
  /** Maximum combo chain reached this run */
  maxCombo: number;
  /** Number of critters scared this run */
  scaresThisRun: number;
  /** Number of raids survived this run */
  raidsSurvived: number;
  /** True if game ended by plunge */
  plunged: boolean;
  /** Seconds of playtime for this run */
  secondsThisRun: number;
}

export interface LifetimeForCheck {
  totalDistanceCm: number;
  totalRunsCompleted: number;
  totalScares: number;
  longestComboChain: number;
  maxSingleRunCrowd: number;
  totalGameOversByPlunge: number;
}

export interface AchievementDef {
  slug: string;
  title: string;
  description: string;
  /** Target value for the progress bar. 1 = binary unlock. */
  targetValue: number;
  /** Predicate evaluated on game-over. Return true → grant now. */
  predicate: (run: RunAchievementStats, lifetime: LifetimeForCheck) => boolean;
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

export const ACHIEVEMENT_CATALOG: readonly AchievementDef[] = [
  {
    slug: 'first-run',
    title: 'Into the Ring!',
    description: 'Complete your very first run.',
    targetValue: 1,
    predicate: (_run, lifetime) => lifetime.totalRunsCompleted >= 1,
  },
  {
    slug: 'first-1km',
    title: 'One Kilometre Clown',
    description: 'Travel 1 km in a single run.',
    targetValue: 1000,
    predicate: (run) => run.distance >= 1000,
  },
  {
    slug: 'first-5km',
    title: 'Five Klicks of Chaos',
    description: 'Travel 5 km in a single run.',
    targetValue: 5000,
    predicate: (run) => run.distance >= 5000,
  },
  {
    slug: 'lifetime-10km',
    title: 'Ten Thousand Metres of Mayhem',
    description: 'Travel 10 km total across all runs.',
    targetValue: 1000000, // 10 km in cm
    predicate: (_run, lifetime) => lifetime.totalDistanceCm >= 1000000,
  },
  {
    slug: 'scare-5-in-run',
    title: 'Crowd Pleaser',
    description: 'Scare 5 critters in a single run.',
    targetValue: 5,
    predicate: (run) => run.scaresThisRun >= 5,
  },
  {
    slug: 'scare-10-in-run',
    title: 'Crowd Terrorizer',
    description: 'Scare 10 critters in a single run.',
    targetValue: 10,
    predicate: (run) => run.scaresThisRun >= 10,
  },
  {
    slug: 'scare-50-lifetime',
    title: 'Professional Prankster',
    description: 'Scare 50 critters across all runs.',
    targetValue: 50,
    predicate: (_run, lifetime) => lifetime.totalScares >= 50,
  },
  {
    slug: 'survive-tiger',
    title: 'Tiger Tamer',
    description: 'Survive a Tiger raid without taking damage.',
    targetValue: 1,
    predicate: (run) => run.raidsSurvived >= 1,
  },
  {
    slug: 'survive-3-raids',
    title: "Ringmaster's Nightmare",
    description: 'Survive 3 raids in a single run.',
    targetValue: 3,
    predicate: (run) => run.raidsSurvived >= 3,
  },
  {
    slug: 'combo-4x',
    title: 'Four-Ring Circus',
    description: 'Reach a 4× combo multiplier.',
    targetValue: 4,
    predicate: (run) => run.maxCombo >= 7, // chain ≥ 7 → 4× tier
  },
  {
    slug: 'combo-8x',
    title: 'Maximum Mayhem',
    description: 'Reach an 8× combo multiplier.',
    targetValue: 8,
    predicate: (run) => run.maxCombo >= 15, // chain ≥ 15 → 8× tier
  },
  {
    slug: 'combo-lifetime-8',
    title: 'Eternal Showman',
    description: 'Reach an 8× combo in any run (lifetime check).',
    targetValue: 1,
    predicate: (_run, lifetime) => lifetime.longestComboChain >= 15,
  },
  {
    slug: 'crowd-500',
    title: 'Standing Ovation',
    description: 'Earn 500 crowd reaction in a single run.',
    targetValue: 500,
    predicate: (run) => run.crowd >= 500,
  },
  {
    slug: 'crowd-1000',
    title: 'They Went Wild',
    description: 'Earn 1000 crowd reaction in a single run.',
    targetValue: 1000,
    predicate: (run) => run.crowd >= 1000,
  },
  {
    slug: 'perfect-ramp',
    title: 'Perfect Launch',
    description: 'Survive a ramp section with zero crashes.',
    targetValue: 1,
    predicate: (run) => run.crashes === 0 && run.distance >= 200,
  },
  {
    slug: 'no-crash-1km',
    title: 'Pristine Paint Job',
    description: 'Travel 1 km without a single crash.',
    targetValue: 1,
    predicate: (run) => run.crashes === 0 && run.distance >= 1000,
  },
  {
    slug: 'plunge-survivor',
    title: 'Off the Edge',
    description: 'Experience your first plunge off the track.',
    targetValue: 1,
    predicate: (_run, lifetime) => lifetime.totalGameOversByPlunge >= 1,
  },
  {
    slug: 'ten-runs',
    title: 'Regular at the Midway',
    description: 'Complete 10 runs.',
    targetValue: 10,
    predicate: (_run, lifetime) => lifetime.totalRunsCompleted >= 10,
  },
  {
    slug: 'fifty-runs',
    title: 'Career Clown',
    description: 'Complete 50 runs.',
    targetValue: 50,
    predicate: (_run, lifetime) => lifetime.totalRunsCompleted >= 50,
  },
  {
    slug: 'all-zones',
    title: 'Full Tour',
    description: 'Travel over 1800 m — cycle through all four zones.',
    targetValue: 1800,
    predicate: (run) => run.distance >= 1800,
  },
] as const;
