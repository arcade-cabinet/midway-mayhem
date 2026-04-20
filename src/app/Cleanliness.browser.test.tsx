/**
 * Cleanliness / racing-line integration test — proves the deviation
 * window + EMA actually respond to lateral drift off the optimal path.
 *
 * Drives into a run, holds the player on-line for a couple of seconds
 * (cleanliness should stay near 1), then slams the steer to one edge
 * and holds it. After enough ticks the cleanliness EMA should sag
 * meaningfully below the on-line baseline.
 */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { diag, driveInto, setSteer, waitForDistance, waitFrames } from '@/test/integration';
import { App } from './App';

describe('Racing-line cleanliness integration', () => {
  it('cleanliness EMA drops when the player drives off the optimal line', async () => {
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

    // Drive straight for a bit so the EMA settles near its initial 1.0.
    setSteer(0);
    await waitForDistance(30, 15_000);
    const onLine = diag();
    expect(
      onLine.cleanliness,
      `cleanliness on-line baseline: ${onLine.cleanliness}`,
    ).toBeGreaterThan(0.7);

    // Hold full-right for a while. The lateral clamp is ~±7m; the
    // optimal line is somewhere near centre, so sitting at +maxLateral
    // is the worst-case racing line.
    setSteer(1);
    await waitFrames(120);
    const drifted = diag();
    expect(
      drifted.cleanliness,
      `cleanliness after sustained drift off-line: ${drifted.cleanliness} (baseline ${onLine.cleanliness})`,
    ).toBeLessThan(onLine.cleanliness);
    // 180s covers CI swiftshader; locally finishes in ~10s.
  }, 180_000);
});
