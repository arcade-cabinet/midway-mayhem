/**
 * @module persistence/achievements
 *
 * Achievement catalog, grant logic, and progress tracking.
 * All writes go through drizzle → SQLite; no localStorage.
 *
 * Flow:
 *   1. Game-over → checkRunAchievements(runStats)
 *   2. checkRunAchievements iterates ACHIEVEMENT_CATALOG, tests predicates
 *   3. Newly-earned slugs → grantAchievement(slug) [idempotent]
 *   4. grantAchievement stamps unlocked_at + publishes via achievementBus
 *   5. AchievementToast subscribes and queues slide-in banners
 */

import { eq } from 'drizzle-orm';
import { publishAchievement } from '../systems/achievementBus';
import { db } from './db';
import { achievements } from './schema';

// ─── Catalog definition ─────────────────────────────────────────────────────

export interface AchievementDef {
  slug: string;
  title: string;
  description: string;
  /** Target value for the progress bar. 1 = binary unlock. */
  targetValue: number;
  /** Predicate evaluated on game-over. Return true → grant now. */
  predicate: (run: RunAchievementStats, lifetime: LifetimeForCheck) => boolean;
}

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
    title: 'Ringmaster\'s Nightmare',
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

// ─── Row types ───────────────────────────────────────────────────────────────

export interface AchievementRow {
  slug: string;
  unlockedAt: number | null;
  progressValue: number;
  targetValue: number;
}

export interface AchievementStatus extends AchievementDef {
  unlockedAt: number | null;
  progressValue: number;
}

// ─── Core API ────────────────────────────────────────────────────────────────

/**
 * Returns all achievements annotated with unlock state and progress.
 * Rows missing from DB are treated as locked with 0 progress.
 */
export async function listAll(): Promise<AchievementStatus[]> {
  const rows = await db().select().from(achievements).all();
  const bySlug = new Map<string, AchievementRow>(
    rows.map((r) => [r.slug, { slug: r.slug, unlockedAt: r.unlockedAt ?? null, progressValue: r.progressValue, targetValue: r.targetValue }]),
  );

  return ACHIEVEMENT_CATALOG.map((def) => {
    const row = bySlug.get(def.slug);
    return {
      ...def,
      unlockedAt: row?.unlockedAt ?? null,
      progressValue: row?.progressValue ?? 0,
    };
  });
}

/**
 * Idempotent grant: stamps unlocked_at on the first call; subsequent calls
 * for an already-earned achievement are no-ops.
 * Broadcasts via achievementBus so HUD can toast.
 */
export async function grantAchievement(slug: string): Promise<void> {
  const now = Date.now();

  // Check if already unlocked
  const existing = await db()
    .select({ unlockedAt: achievements.unlockedAt })
    .from(achievements)
    .where(eq(achievements.slug, slug))
    .get();

  if (existing?.unlockedAt != null) return; // already earned — idempotent

  const def = ACHIEVEMENT_CATALOG.find((d) => d.slug === slug);

  // Upsert: insert or update unlocked_at
  await db()
    .insert(achievements)
    .values({
      slug,
      unlockedAt: now,
      progressValue: def?.targetValue ?? 1,
      targetValue: def?.targetValue ?? 1,
    })
    .onConflictDoUpdate({
      target: achievements.slug,
      set: { unlockedAt: now, progressValue: def?.targetValue ?? 1 },
    })
    .run();

  // Notify subscribers (HUD toast)
  publishAchievement({
    slug,
    title: def?.title ?? slug,
    at: now,
  });
}

/**
 * Update incremental progress for a cumulative achievement.
 * Does not grant the achievement automatically — call grantAchievement after
 * if the predicate is met.
 */
export async function updateProgress(slug: string, value: number): Promise<void> {
  const def = ACHIEVEMENT_CATALOG.find((d) => d.slug === slug);
  const targetValue = def?.targetValue ?? 1;

  await db()
    .insert(achievements)
    .values({ slug, progressValue: value, targetValue })
    .onConflictDoUpdate({
      target: achievements.slug,
      set: { progressValue: value },
    })
    .run();
}

/**
 * Called on game-over. Evaluates every catalog predicate against the run's
 * stats + current lifetime totals, then grants any newly-earned achievements.
 *
 * Lifetime totals passed in (not re-fetched) to avoid an extra DB round-trip;
 * callers should use getStats() from lifetimeStats.ts before calling this.
 */
export async function checkRunAchievements(
  runStats: RunAchievementStats,
  lifetime: LifetimeForCheck,
): Promise<void> {
  for (const def of ACHIEVEMENT_CATALOG) {
    if (def.predicate(runStats, lifetime)) {
      await grantAchievement(def.slug);
    }
  }
}
