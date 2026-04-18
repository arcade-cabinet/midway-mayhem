/**
 * Persistence integration test — proves run-end writes land in SQLite.
 *
 * Drives a run, ends it via the diag bus, then reads the profile row
 * back and asserts totalRuns incremented and bestDistanceCm reflects
 * the run distance. Catches regressions where endRun fires but
 * persistRunEnd silently fails.
 */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { initDb } from '@/persistence/db';
import { getProfile } from '@/persistence/profile';
import { diag, driveInto, endRun, waitForDistance, waitFrames } from '@/test/integration';
import { App } from './App';

describe('Persistence integration', () => {
  it('records run-end distance + increments totalRuns in SQLite profile', async () => {
    await initDb();
    const before = await getProfile();

    const { container } = render(<App />);
    await waitFor(
      () => {
        const el = container.querySelector('canvas');
        if (!el) throw new Error('canvas not rendered');
        return el;
      },
      { timeout: 10_000 },
    );
    await waitFrames(15);

    await driveInto(container);

    // Cover enough distance to make the best-distance assertion meaningful.
    await waitForDistance(50, 15_000);

    const runDistance = diag().distance;
    expect(runDistance).toBeGreaterThan(50);

    // End the run via the diag bus; persistRunEnd is fire-and-forget so
    // poll getProfile until the write lands.
    endRun();

    const expectedCm = Math.round(runDistance * 100);
    await waitFor(
      async () => {
        const p = await getProfile();
        if (p.totalRuns <= before.totalRuns) {
          throw new Error(`totalRuns not yet incremented (${before.totalRuns} → ${p.totalRuns})`);
        }
        if (p.bestDistanceCm < expectedCm) {
          throw new Error(
            `bestDistanceCm ${p.bestDistanceCm} < expected ${expectedCm} (distance ${runDistance}m)`,
          );
        }
      },
      { timeout: 10_000, interval: 100 },
    );

    const after = await getProfile();
    expect(after.totalRuns).toBe(before.totalRuns + 1);
    expect(after.bestDistanceCm).toBeGreaterThanOrEqual(expectedCm);
    expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
  });
});
