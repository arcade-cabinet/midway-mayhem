/**
 * Procedural track integration test — proves the track geometry actually
 * streams under the player as they drive. The old "canvas is visible"
 * gates can't tell the difference between a track that advances through
 * zones and one that's frozen on a single piece.
 *
 * Drives through the title → DRIVE flow, then asserts:
 *   - trackPieces stays stable (procedural composer is mounted)
 *   - currentZone transitions off the starting "midway-strip"
 *   - trackPieces is stable-or-growing (composer didn't unwind)
 */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { diag, driveInto, waitForDistance, waitFrames } from '@/test/integration';
import { App } from './App';

describe('Procedural track integration', () => {
  it('streams real track pieces and transitions zones as the player advances', async () => {
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

    // Drive in on the highest non-permadeath tier so the zone cycle
    // (every 450m) happens faster than the test's wall-clock budget.
    await driveInto(container, /NIGHTMARE MIDWAY/i);

    // Baseline: procedural track is already populated and we're in
    // the first zone.
    const baseline = diag();
    expect(
      baseline.trackPieces,
      `trackPieces at baseline was ${baseline.trackPieces}`,
    ).toBeGreaterThan(0);
    expect(baseline.currentZone, 'expected to start in midway-strip').toBe('midway-strip');

    // Drive past the first zone boundary (450m).
    await waitForDistance(450, 30_000);

    const advanced = diag();
    expect(advanced.distance).toBeGreaterThan(450);
    expect(
      advanced.currentZone,
      `expected zone transition off midway-strip, still at ${advanced.currentZone} distance=${advanced.distance}`,
    ).not.toBe('midway-strip');

    // Composer window should be stable or growing, never shrinking.
    expect(advanced.trackPieces).toBeGreaterThanOrEqual(baseline.trackPieces);
  });
});
