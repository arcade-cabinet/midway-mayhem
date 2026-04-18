/**
 * Pause integration test — proves the paused RunSession freezes the
 * gameplay tick so distance stops advancing, and resume() unfreezes it.
 *
 * Catches regressions where tickGameState forgets to gate on
 * RunSession.paused (or the pause/resume setters miss a code path and
 * the store falls out of sync with the tick guard).
 */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { diag, driveInto, pause, resume, waitForDistance, waitFrames } from '@/test/integration';
import { App } from './App';

describe('Pause integration', () => {
  it('distance stops advancing while paused and resumes afterwards', async () => {
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
    await waitForDistance(10, 15_000);

    pause();
    await waitFrames(5);
    const pausedSnap = diag();
    expect(pausedSnap.paused, 'paused flag should be true after __mm.pause()').toBe(true);
    const pausedDistance = pausedSnap.distance;

    // Hold paused for 30 frames — distance must not advance.
    await waitFrames(30);
    const stillPaused = diag();
    expect(
      Math.abs(stillPaused.distance - pausedDistance),
      `distance advanced from ${pausedDistance} to ${stillPaused.distance} while paused`,
    ).toBeLessThanOrEqual(0.5);

    // Resume — distance should start moving again within a few frames.
    resume();
    await waitFrames(20);
    const resumed = diag();
    expect(resumed.paused, 'paused flag should be false after __mm.resume()').toBe(false);
    expect(resumed.distance).toBeGreaterThan(pausedDistance);
  });
});
