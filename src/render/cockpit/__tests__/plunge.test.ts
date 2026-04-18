import { describe, expect, it } from 'vitest';
import {
  computePlungeOffset,
  PLUNGE_GRAVITY_MPS2,
  PLUNGE_LATERAL_SLIDE_MPS,
} from '../plungeMotion';

/** Total plunge animation window in seconds (mirrors reference/src/game/gameStateTick.ts). */
const PLUNGE_DURATION_S = 1.5;

describe('computePlungeOffset', () => {
  it('returns zero offset at t=0', () => {
    const o = computePlungeOffset(0, 1);
    expect(o.x).toBe(0);
    // y can be -0 from (-0.5 * g * 0 * 0); just assert it is zero in magnitude.
    expect(Math.abs(o.y)).toBe(0);
    expect(o.rotX).toBe(0);
    expect(o.rotZ).toBe(0);
  });

  it('falls more than a meter after 0.5s (meaningful drop)', () => {
    // y = -0.5 * 9.8 * 0.5^2 = -1.225m
    const o = computePlungeOffset(0.5, 1);
    // Assert the cockpit has fallen past y = initial - 1m.
    expect(o.y).toBeLessThan(-1);
  });

  it('Y is strictly decreasing through the entire plunge window', () => {
    const samples = 60;
    let prevY = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= samples; i++) {
      const t = (PLUNGE_DURATION_S * i) / samples;
      const o = computePlungeOffset(t, 1);
      if (i > 0) expect(o.y).toBeLessThan(prevY);
      prevY = o.y;
    }
  });

  it('accelerates (second-half drop exceeds first-half drop)', () => {
    // Gravity means the distance covered in t=[0.5,1] is > distance in t=[0,0.5].
    const a = computePlungeOffset(0.5, 1).y;
    const b = computePlungeOffset(1.0, 1).y;
    const firstHalf = a; // negative, from 0 to -1.225
    const secondHalf = b - a; // more negative
    expect(secondHalf).toBeLessThan(firstHalf);
  });

  it('slides laterally in the plunge direction', () => {
    const left = computePlungeOffset(1, -1);
    const right = computePlungeOffset(1, 1);
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
    // Magnitude matches LATERAL_SLIDE_MPS * t
    expect(Math.abs(right.x)).toBeCloseTo(PLUNGE_LATERAL_SLIDE_MPS, 6);
  });

  it('matches the free-fall formula y = -0.5 * g * t^2', () => {
    for (const t of [0.1, 0.3, 0.7, 1.4]) {
      const y = computePlungeOffset(t, 1).y;
      expect(y).toBeCloseTo(-0.5 * PLUNGE_GRAVITY_MPS2 * t * t, 9);
    }
  });

  it('pitch and roll grow with time in the plunge direction', () => {
    const early = computePlungeOffset(0.2, -1);
    const late = computePlungeOffset(1.0, -1);
    expect(late.rotX).toBeGreaterThan(early.rotX);
    // Left plunge → negative roll.
    expect(late.rotZ).toBeLessThan(early.rotZ);
    expect(late.rotZ).toBeLessThan(0);
  });

  it('treats direction=0 as +1 to avoid a dead stall', () => {
    const o = computePlungeOffset(1, 0);
    expect(o.x).toBeGreaterThan(0);
  });

  it('negative elapsedSeconds are clamped to 0', () => {
    const o = computePlungeOffset(-5, 1);
    expect(o.x).toBe(0);
    expect(Math.abs(o.y)).toBe(0);
  });
});
