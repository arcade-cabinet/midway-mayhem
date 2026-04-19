/**
 * plungeMotion unit tests — pure free-fall curve for cockpit plunge.
 */
import { describe, expect, it } from 'vitest';
import {
  computePlungeOffset,
  PLUNGE_GRAVITY_MPS2,
  PLUNGE_LATERAL_SLIDE_MPS,
  PLUNGE_PITCH_RATE,
  PLUNGE_ROLL_RATE,
} from '@/render/cockpit/plungeMotion';

describe('plungeMotion constants', () => {
  it('gravity is 9.8 m/s²', () => {
    expect(PLUNGE_GRAVITY_MPS2).toBe(9.8);
  });

  it('lateral slide, pitch, and roll rates are positive', () => {
    expect(PLUNGE_LATERAL_SLIDE_MPS).toBeGreaterThan(0);
    expect(PLUNGE_PITCH_RATE).toBeGreaterThan(0);
    expect(PLUNGE_ROLL_RATE).toBeGreaterThan(0);
  });
});

describe('computePlungeOffset', () => {
  it('returns zero offsets at t=0', () => {
    const p = computePlungeOffset(0, 1);
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(0, 10);
    expect(p.rotX).toBeCloseTo(0, 10);
    expect(p.rotZ).toBeCloseTo(0, 10);
  });

  it('clamps negative elapsedSeconds to 0', () => {
    const p = computePlungeOffset(-5, 1);
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(0, 10);
  });

  it('y follows the free-fall curve: y(t) = -0.5 * g * t²', () => {
    const t = 1.5;
    const p = computePlungeOffset(t, 1);
    expect(p.y).toBeCloseTo(-0.5 * PLUNGE_GRAVITY_MPS2 * t * t, 6);
  });

  it('y is always ≤ 0 for t > 0 and strictly decreasing', () => {
    const a = computePlungeOffset(0.5, 1);
    const b = computePlungeOffset(1.0, 1);
    const c = computePlungeOffset(2.0, 1);
    expect(a.y).toBeLessThanOrEqual(0);
    expect(b.y).toBeLessThan(a.y);
    expect(c.y).toBeLessThan(b.y);
  });

  it('x = direction * slide_speed * t (positive direction)', () => {
    const t = 2;
    const p = computePlungeOffset(t, 1);
    expect(p.x).toBeCloseTo(PLUNGE_LATERAL_SLIDE_MPS * t, 6);
  });

  it('x flips sign for negative direction', () => {
    const t = 2;
    const p = computePlungeOffset(t, -1);
    expect(p.x).toBeCloseTo(-PLUNGE_LATERAL_SLIDE_MPS * t, 6);
  });

  it('direction=0 defaults to +1 (no zero-sign collapse)', () => {
    const p = computePlungeOffset(1, 0);
    expect(p.x).toBeGreaterThan(0);
    expect(p.rotZ).toBeGreaterThan(0);
  });

  it('rotX (pitch) increases linearly with t at PLUNGE_PITCH_RATE', () => {
    const p = computePlungeOffset(2, 1);
    expect(p.rotX).toBeCloseTo(PLUNGE_PITCH_RATE * 2, 6);
  });

  it('rotZ (roll) = dir * roll_rate * t — signed', () => {
    const a = computePlungeOffset(2, 1);
    const b = computePlungeOffset(2, -1);
    expect(a.rotZ).toBeCloseTo(PLUNGE_ROLL_RATE * 2, 6);
    expect(b.rotZ).toBeCloseTo(-PLUNGE_ROLL_RATE * 2, 6);
  });

  it('is deterministic — same inputs produce the same offset', () => {
    expect(computePlungeOffset(1.7, -1)).toEqual(computePlungeOffset(1.7, -1));
  });

  it('normalises arbitrary magnitude directions to ±1 via Math.sign', () => {
    const p1 = computePlungeOffset(1, 1);
    const p10 = computePlungeOffset(1, 42);
    expect(p1.x).toBeCloseTo(p10.x, 6);
    expect(p1.rotZ).toBeCloseTo(p10.rotZ, 6);
  });
});
