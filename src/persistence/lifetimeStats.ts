/**
 * @module persistence/lifetimeStats
 *
 * Singleton row of all-time counters. Called once per game-over from
 * gameState.endRun() finalization. Never called mid-run.
 *
 * resetStats() is debug-only and deliberately not exported from the
 * persistence barrel — it must never appear in production UI.
 */

import { eq } from 'drizzle-orm';
import { db } from './db';
import { lifetimeStats } from './schema';

export interface LifetimeStatsRow {
  totalDistanceCm: number;
  totalCrashes: number;
  totalScares: number;
  totalTicketsEarned: number;
  totalRunsCompleted: number;
  totalGameOversByPlunge: number;
  totalGameOversBySanity: number;
  longestComboChain: number;
  maxSingleRunCrowd: number;
  /** JSON object keyed by ZoneId → best time in ms */
  bestZoneTimeMs: Record<string, number>;
  secondsPlayed: number;
}

export interface RunSummary {
  /** Distance in metres (will be converted to cm for storage) */
  distanceM: number;
  crashes: number;
  scares: number;
  ticketsEarned: number;
  crowd: number;
  maxComboChain: number;
  plunged: boolean;
  secondsPlayed: number;
  /** Optional per-zone best times for this run (ZoneId → ms) */
  zoneTimesMs?: Record<string, number>;
}

/**
 * Returns the singleton lifetime-stats row.
 * Creates it via seedDefaults() on DB init; this is a hard fail if missing.
 */
export async function getStats(): Promise<LifetimeStatsRow> {
  const row = await db().select().from(lifetimeStats).where(eq(lifetimeStats.id, 1)).get();

  if (!row) throw new Error('[lifetimeStats] Row missing — was initDb() called?');

  return {
    totalDistanceCm: row.totalDistanceCm,
    totalCrashes: row.totalCrashes,
    totalScares: row.totalScares,
    totalTicketsEarned: row.totalTicketsEarned,
    totalRunsCompleted: row.totalRunsCompleted,
    totalGameOversByPlunge: row.totalGameOversByPlunge,
    totalGameOversBySanity: row.totalGameOversBySanity,
    longestComboChain: row.longestComboChain,
    maxSingleRunCrowd: row.maxSingleRunCrowd,
    bestZoneTimeMs: JSON.parse(row.bestZoneTimeMs) as Record<string, number>,
    secondsPlayed: row.secondsPlayed,
  };
}

/**
 * Atomically increment all relevant counters and update personal bests.
 * Called exactly once per game-over from gameState finalization.
 *
 * The read/merge/write is wrapped in a transaction so concurrent run
 * completions cannot drop totals or overwrite a better zone-time merge.
 */
export async function recordRun(summary: RunSummary): Promise<void> {
  const distanceCm = Math.round(summary.distanceM * 100);

  await db().transaction(async (tx) => {
    const row = await tx.select().from(lifetimeStats).where(eq(lifetimeStats.id, 1)).get();
    if (!row)
      throw new Error('[lifetimeStats] Row missing inside transaction — was initDb() called?');

    const current: LifetimeStatsRow = {
      totalDistanceCm: row.totalDistanceCm,
      totalCrashes: row.totalCrashes,
      totalScares: row.totalScares,
      totalTicketsEarned: row.totalTicketsEarned,
      totalRunsCompleted: row.totalRunsCompleted,
      totalGameOversByPlunge: row.totalGameOversByPlunge,
      totalGameOversBySanity: row.totalGameOversBySanity,
      longestComboChain: row.longestComboChain,
      maxSingleRunCrowd: row.maxSingleRunCrowd,
      bestZoneTimeMs: JSON.parse(row.bestZoneTimeMs) as Record<string, number>,
      secondsPlayed: row.secondsPlayed,
    };

    // Merge per-zone best times
    const mergedZoneTimes: Record<string, number> = { ...current.bestZoneTimeMs };
    if (summary.zoneTimesMs) {
      for (const [zone, ms] of Object.entries(summary.zoneTimesMs)) {
        const existing = mergedZoneTimes[zone];
        if (existing === undefined || ms < existing) {
          mergedZoneTimes[zone] = ms;
        }
      }
    }

    await tx
      .update(lifetimeStats)
      .set({
        totalDistanceCm: current.totalDistanceCm + distanceCm,
        totalCrashes: current.totalCrashes + summary.crashes,
        totalScares: current.totalScares + summary.scares,
        totalTicketsEarned: current.totalTicketsEarned + summary.ticketsEarned,
        totalRunsCompleted: current.totalRunsCompleted + 1,
        totalGameOversByPlunge: current.totalGameOversByPlunge + (summary.plunged ? 1 : 0),
        totalGameOversBySanity: current.totalGameOversBySanity + (summary.plunged ? 0 : 1),
        longestComboChain: Math.max(current.longestComboChain, summary.maxComboChain),
        maxSingleRunCrowd: Math.max(current.maxSingleRunCrowd, summary.crowd),
        bestZoneTimeMs: JSON.stringify(mergedZoneTimes),
        secondsPlayed: current.secondsPlayed + Math.round(summary.secondsPlayed),
      })
      .where(eq(lifetimeStats.id, 1))
      .run();
  });
}

/**
 * Debug-only hard reset. Not exported from the persistence barrel.
 * Only call in test setup or debug menus — never from production UI.
 */
export async function resetStats(): Promise<void> {
  await db()
    .update(lifetimeStats)
    .set({
      totalDistanceCm: 0,
      totalCrashes: 0,
      totalScares: 0,
      totalTicketsEarned: 0,
      totalRunsCompleted: 0,
      totalGameOversByPlunge: 0,
      totalGameOversBySanity: 0,
      longestComboChain: 0,
      maxSingleRunCrowd: 0,
      bestZoneTimeMs: '{}',
      secondsPlayed: 0,
    })
    .where(eq(lifetimeStats.id, 1))
    .run();
}
