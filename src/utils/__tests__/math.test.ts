import { describe, expect, it } from 'vitest';
import { clamp, clampPct, damp, distSq2, lerp, smoothstep, wrap } from '@/utils/math';

describe('clamp', () => {
  it('clamps below min and above max, passes through in range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe('clampPct', () => {
  it('clamps to [0, 100]', () => {
    expect(clampPct(-1)).toBe(0);
    expect(clampPct(101)).toBe(100);
    expect(clampPct(42.5)).toBe(42.5);
  });
});

describe('lerp', () => {
  it('interpolates linearly', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
  it('extrapolates past endpoints', () => {
    expect(lerp(0, 10, -1)).toBe(-10);
    expect(lerp(0, 10, 2)).toBe(20);
  });
});

describe('damp', () => {
  it('returns current unchanged at dt=0', () => {
    expect(damp(3, 7, 1, 0)).toBe(3);
  });
  it('moves toward target with every tick', () => {
    const next = damp(0, 10, 1, 0.5);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(10);
  });
  it('approaches target as dt → infinity', () => {
    const next = damp(0, 10, 1, 1000);
    expect(next).toBeCloseTo(10, 6);
  });
  it('throws on non-finite or zero tau', () => {
    expect(() => damp(0, 1, 0, 0.1)).toThrow(/tau/);
    expect(() => damp(0, 1, Number.NaN, 0.1)).toThrow(/tau/);
  });
  it('throws on negative dt', () => {
    expect(() => damp(0, 1, 1, -0.1)).toThrow(/dt/);
  });
});

describe('smoothstep', () => {
  it('returns 0 at or below edge0', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0)).toBe(0);
  });
  it('returns 1 at or above edge1', () => {
    expect(smoothstep(0, 1, 1)).toBe(1);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });
  it('returns the Hermite value at midpoint', () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 6);
  });
  it('throws on identical edges', () => {
    expect(() => smoothstep(1, 1, 0.5)).toThrow(/distinct/);
  });
});

describe('wrap', () => {
  it('wraps positive values modulo max', () => {
    expect(wrap(5, 3)).toBe(2);
    expect(wrap(0, 3)).toBe(0);
  });
  it('wraps negative values into [0, max)', () => {
    expect(wrap(-1, 3)).toBe(2);
    expect(wrap(-4, 3)).toBe(2);
  });
  it('throws on non-positive max', () => {
    expect(() => wrap(1, 0)).toThrow(/max/);
    expect(() => wrap(1, -1)).toThrow(/max/);
  });
});

describe('distSq2', () => {
  it('computes squared 2D distance on the xz plane', () => {
    expect(distSq2(0, 0, 3, 4)).toBe(25);
    expect(distSq2(1, 1, 1, 1)).toBe(0);
    expect(distSq2(-1, 0, 1, 0)).toBe(4);
  });
});
