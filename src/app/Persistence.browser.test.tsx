/**
 * Persistence integration test — proves run-end writes land in SQLite.
 *
 * Mounts <App/>, drives through a run, calls __mm.end() to end the run,
 * then reads the profile row back from the persistence layer and asserts
 * totalRuns incremented and bestDistanceCm reflects the run distance.
 *
 * Catches regressions where endRun fires but persistRunEnd silently
 * fails (previously almost happened when we moved recordRun between
 * useGameSystems and runEndPersistence).
 */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { initDb } from '@/persistence/db';
import { getProfile } from '@/persistence/profile';
import { waitFrames } from '@/test/scene';
import { App } from './App';

function findButton(root: HTMLElement, match: RegExp): HTMLButtonElement | null {
  const buttons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.find((b) => match.test((b.textContent || '').trim())) ?? null;
}

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

    // Click through to DRIVE.
    const newRun = await waitFor(
      () =>
        findButton(container, /^\s*NEW\s+RUN\s*$/i) ??
        (() => {
          throw new Error('no new-run');
        })(),
      { timeout: 5_000 },
    );
    newRun.click();

    const tier = await waitFor(
      () =>
        findButton(container, /KAZOO/i) ??
        (() => {
          throw new Error('no difficulty');
        })(),
      { timeout: 5_000 },
    );
    tier.click();

    const play = await waitFor(
      () =>
        findButton(container, /▶\s*PLAY/) ??
        (() => {
          throw new Error('no play');
        })(),
      { timeout: 5_000 },
    );
    play.click();

    // Wait past drop-in so distance advances.
    await waitFor(
      () => {
        const d = window.__mm?.diag?.();
        const p = (d?.dropProgress as number) ?? 0;
        if (p < 1) throw new Error(`drop-in ${p.toFixed(2)}`);
      },
      { timeout: 10_000, interval: 50 },
    );

    // Drive until we've covered meaningful distance.
    await waitFor(
      () => {
        const d = window.__mm?.diag?.();
        const dist = (d?.distance as number) ?? 0;
        if (dist < 50) throw new Error(`distance only ${dist.toFixed(0)}m`);
      },
      { timeout: 15_000, interval: 100 },
    );

    const finalDiag = window.__mm?.diag?.() as Record<string, unknown> | undefined;
    const runDistance = (finalDiag?.distance as number) ?? 0;
    expect(runDistance).toBeGreaterThan(50);

    // End the run via the diag bus.
    window.__mm?.end?.();

    // persistRunEnd is fire-and-forget — poll until the write lands.
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
        return p;
      },
      { timeout: 10_000, interval: 100 },
    );

    const after = await getProfile();
    expect(after.totalRuns).toBe(before.totalRuns + 1);
    expect(after.bestDistanceCm).toBeGreaterThanOrEqual(expectedCm);
    expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
  });
});
