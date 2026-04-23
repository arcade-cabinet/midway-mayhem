/**
 * Unit tests for the cockpit descent-pitch helpers.
 * Pure math — no DOM, no R3F, no ECS. Covers the invariants that the
 * PRQ specifies: correct scaling, correct smoothing direction, and correct
 * framerate-independence.
 */
import { describe, expect, it } from 'vitest';
import {
  DESCENT_LOOK_FACTOR,
  DESCENT_SMOOTHING_HZ,
  getCockpitDescentPitch,
  smoothDescentPitch,
} from '@/render/cockpit/cockpitDescentPitch';

describe('getCockpitDescentPitch', () => {
  it('returns 0 for flat track (pitch = 0)', () => {
    expect(getCockpitDescentPitch(0)).toBe(0);
  });

  it('returns −0.032 rad for a plunge at −0.08 rad (40 % factor)', () => {
    const result = getCockpitDescentPitch(-0.08);
    expect(result).toBeCloseTo(-0.032, 6);
  });

  it('returns +0.008 rad for a climb at +0.02 rad', () => {
    const result = getCockpitDescentPitch(0.02);
    expect(result).toBeCloseTo(0.008, 6);
  });

  it('applies DESCENT_LOOK_FACTOR exactly', () => {
    const pitch = 1.0;
    expect(getCockpitDescentPitch(pitch)).toBeCloseTo(DESCENT_LOOK_FACTOR, 10);
  });
});

describe('smoothDescentPitch', () => {
  it('returns current unchanged when dt = 0', () => {
    expect(smoothDescentPitch(0.5, 1.0, 0)).toBe(0.5);
  });

  it('approaches target — never overshoots or returns NaN', () => {
    let v = 0;
    const target = -0.032;
    for (let i = 0; i < 300; i++) {
      v = smoothDescentPitch(v, target, 1 / 60);
      expect(v).not.toBeNaN();
      // Exponential approach stays between start and target.
      expect(v).toBeGreaterThanOrEqual(target);
      expect(v).toBeLessThanOrEqual(0);
    }
  });

  it('reaches > 86 % of target after 1 s (1 − e^(−2·1) ≈ 0.865)', () => {
    // Integral of the smoothing kernel over t = 1 s using 60 Hz steps.
    let v = 0;
    const target = 1.0;
    const dt = 1 / 60;
    const steps = Math.round(1 / dt);
    for (let i = 0; i < steps; i++) {
      v = smoothDescentPitch(v, target, dt);
    }
    // Continuous-time prediction: 1 − exp(−DESCENT_SMOOTHING_HZ · 1)
    const theoreticalFraction = 1 - Math.exp(-DESCENT_SMOOTHING_HZ * 1);
    // The discrete approximation at 60 Hz is within 0.5 % of the continuous form.
    expect(v).toBeGreaterThan(theoreticalFraction - 0.005);
    expect(v).toBeGreaterThan(0.86);
  });

  it('handles large dt without NaN (not expected in prod but must not explode)', () => {
    const result = smoothDescentPitch(0, 1, 100);
    expect(result).not.toBeNaN();
    expect(result).toBeCloseTo(1, 4); // converges fully at large dt
  });
});
