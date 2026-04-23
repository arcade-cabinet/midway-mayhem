/**
 * Unit tests for the smoothstep helper in track.ts.
 *
 * S(t) = 3t² − 2t³ must satisfy:
 *   S(0) = 0, S(1) = 1        — preserves total delta (endPose continuity)
 *   S(0.5) = 0.5               — symmetric around the midpoint
 *   S′(0) = 0, S′(1) = 0      — zero pitch-rate at piece boundaries (no crease)
 */
import { describe, expect, it } from 'vitest';
import { smoothstep } from '../track';

const EPS = 1e-6;

describe('smoothstep', () => {
  it('S(0) = 0', () => {
    expect(smoothstep(0)).toBe(0);
  });

  it('S(1) = 1', () => {
    expect(smoothstep(1)).toBe(1);
  });

  it('S(0.5) = 0.5 — symmetric midpoint', () => {
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 10);
  });

  it('S′(0) ≈ 0 — zero pitch-rate at piece start (no entry crease)', () => {
    // Numerical derivative: (S(ε) − S(0)) / ε ≈ S′(0)
    const derivative = (smoothstep(EPS) - smoothstep(0)) / EPS;
    expect(Math.abs(derivative)).toBeLessThan(1e-4);
  });

  it('S′(1) ≈ 0 — zero pitch-rate at piece end (no exit crease)', () => {
    // Numerical derivative: (S(1) − S(1−ε)) / ε ≈ S′(1)
    const derivative = (smoothstep(1) - smoothstep(1 - EPS)) / EPS;
    expect(Math.abs(derivative)).toBeLessThan(1e-4);
  });

  it('is monotonically non-decreasing on [0, 1]', () => {
    const N = 100;
    for (let i = 0; i < N; i++) {
      const t0 = i / N;
      const t1 = (i + 1) / N;
      expect(smoothstep(t1)).toBeGreaterThanOrEqual(smoothstep(t0) - 1e-12);
    }
  });
});
