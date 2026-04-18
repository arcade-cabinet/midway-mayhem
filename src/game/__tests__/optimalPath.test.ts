/**
 * optimalPath unit tests — cover the pure scoring primitives
 * (optimalLateralAt, scoreDeviation). Solver coverage is exercised
 * end-to-end via difficultyTelemetry and the e2e scripts; these tests
 * focus on the hot-path math consumed every frame at runtime.
 */
import { describe, expect, it } from 'vitest';
import { type OptimalPath, optimalLateralAt, scoreDeviation } from '@/game/optimalPath';

function path(
  waypoints: Array<{ d: number; lane: number; lateralM: number }>,
  distance?: number,
): OptimalPath {
  return {
    seed: 0,
    waypoints: waypoints.map((w) => ({ ...w, reason: 'center' as const })),
    distance: distance ?? waypoints[waypoints.length - 1]?.d ?? 0,
  };
}

describe('optimalLateralAt', () => {
  it('returns 0 for an empty path', () => {
    expect(optimalLateralAt(path([]), 100)).toBe(0);
  });

  it('clamps to first waypoint lateral for d before the path', () => {
    const p = path([
      { d: 10, lane: 1, lateralM: -1.65 },
      { d: 20, lane: 2, lateralM: 1.65 },
    ]);
    expect(optimalLateralAt(p, 0)).toBeCloseTo(-1.65, 6);
    expect(optimalLateralAt(p, -50)).toBeCloseTo(-1.65, 6);
  });

  it('clamps to last waypoint lateral for d past the path', () => {
    const p = path([
      { d: 10, lane: 1, lateralM: -1.65 },
      { d: 20, lane: 2, lateralM: 1.65 },
    ]);
    expect(optimalLateralAt(p, 30)).toBeCloseTo(1.65, 6);
    expect(optimalLateralAt(p, 1e6)).toBeCloseTo(1.65, 6);
  });

  it('interpolates linearly between bracketing waypoints', () => {
    const p = path([
      { d: 0, lane: 0, lateralM: -4.95 },
      { d: 10, lane: 3, lateralM: 4.95 },
    ]);
    expect(optimalLateralAt(p, 5)).toBeCloseTo(0, 6);
    expect(optimalLateralAt(p, 2.5)).toBeCloseTo(-2.475, 6);
  });

  it('returns exact waypoint lateral at waypoint distance', () => {
    const p = path([
      { d: 0, lane: 1, lateralM: -1.65 },
      { d: 50, lane: 2, lateralM: 1.65 },
      { d: 100, lane: 1, lateralM: -1.65 },
    ]);
    expect(optimalLateralAt(p, 50)).toBeCloseTo(1.65, 6);
  });

  it('handles multi-segment paths correctly', () => {
    const p = path([
      { d: 0, lane: 1, lateralM: -1.65 },
      { d: 10, lane: 2, lateralM: 1.65 },
      { d: 20, lane: 1, lateralM: -1.65 },
    ]);
    expect(optimalLateralAt(p, 5)).toBeCloseTo(0, 6);
    expect(optimalLateralAt(p, 15)).toBeCloseTo(0, 6);
  });
});

describe('scoreDeviation', () => {
  it('returns 0 with fewer than 2 samples', () => {
    const p = path([
      { d: 0, lane: 1, lateralM: 0 },
      { d: 100, lane: 1, lateralM: 0 },
    ]);
    expect(scoreDeviation(p, [])).toBe(0);
    expect(scoreDeviation(p, [{ d: 10, lateralM: 0 }])).toBe(0);
  });

  it('returns 0 when player tracks the optimal line perfectly', () => {
    const p = path([
      { d: 0, lane: 0, lateralM: -5 },
      { d: 10, lane: 0, lateralM: 5 },
    ]);
    const samples = [
      { d: 0, lateralM: -5 },
      { d: 5, lateralM: 0 },
      { d: 10, lateralM: 5 },
    ];
    expect(scoreDeviation(p, samples)).toBeCloseTo(0, 6);
  });

  it('ignores samples with non-positive delta d', () => {
    const p = path([
      { d: 0, lane: 1, lateralM: 0 },
      { d: 100, lane: 1, lateralM: 0 },
    ]);
    // Backtracking / duplicate d samples contribute 0 span → result 0.
    const samples = [
      { d: 10, lateralM: 2 },
      { d: 10, lateralM: 2 },
      { d: 5, lateralM: 2 },
    ];
    expect(scoreDeviation(p, samples)).toBe(0);
  });

  it('computes squared-error mean weighted by segment length', () => {
    // Optimal is flat lateralM=0 across [0, 10]. Player sits at lateralM=2.
    const p = path([
      { d: 0, lane: 1, lateralM: 0 },
      { d: 10, lane: 1, lateralM: 0 },
    ]);
    const samples = [
      { d: 0, lateralM: 2 },
      { d: 10, lateralM: 2 },
    ];
    // sq = 2*2 * 10 = 40, span = 10, score = 4.
    expect(scoreDeviation(p, samples)).toBeCloseTo(4, 6);
  });

  it('weights longer segments more than shorter ones', () => {
    const p = path([
      { d: 0, lane: 1, lateralM: 0 },
      { d: 100, lane: 1, lateralM: 0 },
    ]);
    // Segment 1: d 0→1, err=3 → sq += 9*1 = 9
    // Segment 2: d 1→10, err=1 → sq += 1*9 = 9
    // span = 10, score = 18/10 = 1.8
    const samples = [
      { d: 0, lateralM: 3 },
      { d: 1, lateralM: 3 },
      { d: 10, lateralM: 1 },
    ];
    expect(scoreDeviation(p, samples)).toBeCloseTo(1.8, 6);
  });

  it('scores worse when player deviates further from optimal', () => {
    const p = path([
      { d: 0, lane: 1, lateralM: 0 },
      { d: 10, lane: 1, lateralM: 0 },
    ]);
    const close = scoreDeviation(p, [
      { d: 0, lateralM: 1 },
      { d: 10, lateralM: 1 },
    ]);
    const far = scoreDeviation(p, [
      { d: 0, lateralM: 4 },
      { d: 10, lateralM: 4 },
    ]);
    expect(far).toBeGreaterThan(close);
  });
});
