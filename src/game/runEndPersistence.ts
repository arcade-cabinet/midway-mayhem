/**
 * @module game/runEndPersistence
 *
 * Asynchronous persistence work triggered at run-end.
 * Extracted from gameState.ts to keep that file under 300 LOC.
 *
 * Writes profile best, lifetime stats, and checks achievements.
 * All errors are routed through errorBus so nothing is silently swallowed.
 */
import { checkRunAchievements } from '@/persistence/achievements';
import { getStats, recordRun as recordLifetimeRun } from '@/persistence/lifetimeStats';
import { recordRun as recordProfileRun } from '@/persistence/profile';

export interface RunEndSummary {
  distance: number;
  crowd: number;
  crashes: number;
  scaresThisRun: number;
  maxComboThisRun: number;
  raidsSurvived: number;
  plunged: boolean;
  startedAt: number;
}

/**
 * Fire-and-forget: persists the run and checks achievements.
 * Called by `endRun()` in the Zustand store — does NOT set any store state.
 */
export function persistRunEnd(s: RunEndSummary): void {
  const secondsPlayed = s.startedAt > 0 ? (performance.now() - s.startedAt) / 1000 : 0;
  const summary = {
    distanceM: s.distance,
    crashes: s.crashes,
    scares: s.scaresThisRun,
    ticketsEarned: 0, // not tracked in summary shape; lifetime stats ignore this field
    crowd: s.crowd,
    maxComboChain: s.maxComboThisRun,
    plunged: s.plunged,
    secondsPlayed,
  };

  Promise.resolve()
    .then(async () => {
      await recordProfileRun({ distance: s.distance, crowd: s.crowd });
      await recordLifetimeRun(summary);
      const lifetime = await getStats();
      await checkRunAchievements(
        {
          distance: s.distance,
          crowd: s.crowd,
          crashes: s.crashes,
          maxCombo: s.maxComboThisRun,
          scaresThisRun: s.scaresThisRun,
          raidsSurvived: s.raidsSurvived,
          plunged: s.plunged,
          secondsThisRun: secondsPlayed,
        },
        {
          totalDistanceCm: lifetime.totalDistanceCm,
          totalRunsCompleted: lifetime.totalRunsCompleted,
          totalScares: lifetime.totalScares,
          longestComboChain: lifetime.longestComboChain,
          maxSingleRunCrowd: lifetime.maxSingleRunCrowd,
          totalGameOversByPlunge: lifetime.totalGameOversByPlunge,
        },
      );
    })
    .catch((err: unknown) => {
      // Import reportError lazily to avoid circular dep at module init
      import('@/game/errorBus').then(({ reportError }) =>
        reportError(err, 'gameState.endRun persistence'),
      );
    });
}
