/**
 * deviationWindow unit tests — the sliding-window mean-squared
 * deviation tracker that feeds the cleanliness EMA.
 *
 * The window is a module singleton, so tests reset it between runs.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEVIATION_WINDOW_M,
  resetDeviationWindow,
  updateDeviationWindow,
} from '@/game/deviationWindow';
import type { OptimalPath } from '@/game/optimalPath';

/** A dead-straight optimal path at lane 0 (lateral=0 everywhere). */
const STRAIGHT_CENTRE: OptimalPath = {
  seed: 0,
  distance: 1000,
  waypoints: [{ d: 0, lane: 2, lateralM: 0, reason: 'center' }],
};

describe('updateDeviationWindow', () => {
  beforeEach(() => {
    resetDeviationWindow();
  });

  it('returns 0 for an empty or single-sample window', () => {
    expect(updateDeviationWindow(0, 0, STRAIGHT_CENTRE)).toBe(0);
  });

  it('returns 0 when every sample sits exactly on the optimal line', () => {
    updateDeviationWindow(0, 0, STRAIGHT_CENTRE);
    updateDeviationWindow(10, 0, STRAIGHT_CENTRE);
    const msd = updateDeviationWindow(20, 0, STRAIGHT_CENTRE);
    expect(msd).toBe(0);
  });

  it('returns the squared lateral error when held constant off-line', () => {
    updateDeviationWindow(0, 2, STRAIGHT_CENTRE);
    updateDeviationWindow(10, 2, STRAIGHT_CENTRE);
    const msd = updateDeviationWindow(20, 2, STRAIGHT_CENTRE);
    // Every sample is 2m off → squared error = 4.
    expect(msd).toBeCloseTo(4, 5);
  });

  it('evicts samples that fall outside the sliding window', () => {
    // Push a far-off-line sample at d=0.
    updateDeviationWindow(0, 5, STRAIGHT_CENTRE);
    // Push on-line samples past the window boundary.
    const cutoffPlus = DEVIATION_WINDOW_M + 5;
    updateDeviationWindow(cutoffPlus, 0, STRAIGHT_CENTRE);
    const msd = updateDeviationWindow(cutoffPlus + 10, 0, STRAIGHT_CENTRE);
    // The 5m-off sample from d=0 is now outside [d-window, d] — eviction
    // leaves only on-line samples, so deviation is 0.
    expect(msd).toBe(0);
  });

  it('reset() clears the window state', () => {
    updateDeviationWindow(0, 3, STRAIGHT_CENTRE);
    updateDeviationWindow(10, 3, STRAIGHT_CENTRE);
    resetDeviationWindow();
    // After reset, the first sample shouldn't see any history.
    expect(updateDeviationWindow(20, 0, STRAIGHT_CENTRE)).toBe(0);
  });
});
