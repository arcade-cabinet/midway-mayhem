/**
 * @module persistence/achievements
 *
 * Achievement grant logic and progress tracking.
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
import { publishAchievement } from '@/game/achievementBus';
import {
  ACHIEVEMENT_CATALOG,
  type AchievementDef,
  type LifetimeForCheck,
  type RunAchievementStats,
} from './achievementCatalog';
import { db } from './db';
import { achievements } from './schema';

// Re-export types + catalog for callers that import from this module.
export type { AchievementDef, LifetimeForCheck, RunAchievementStats };
export { ACHIEVEMENT_CATALOG };

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
    rows.map((r) => [
      r.slug,
      {
        slug: r.slug,
        unlockedAt: r.unlockedAt ?? null,
        progressValue: r.progressValue,
        targetValue: r.targetValue,
      },
    ]),
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
