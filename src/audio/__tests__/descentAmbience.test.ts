/**
 * Unit tests for the descent-ambience gain/filter curve math (PRQ C-DESCENT-AMBIENCE).
 *
 * These are pure-function tests — they do not touch Tone.js, AudioContext, or the DOM.
 * They assert the numeric curve contract that the rest of the audio system depends on.
 */
import { describe, expect, it } from 'vitest';
import { descentGainDb, descentLpHz } from '../descentAmbience';

describe('descentGainDb', () => {
  it('returns -Infinity at t=0 (top of descent — crowd completely silent)', () => {
    expect(descentGainDb(0)).toBe(-Infinity);
  });

  it('returns a value ≤ descentAmbienceTopDb at t≈0 from above', () => {
    // Even at a tiny t the curve should be deeply attenuated (< -40 dB).
    const tiny = descentGainDb(0.001);
    expect(tiny).not.toBe(-Infinity);
    expect(tiny).toBeLessThan(-40);
  });

  it('returns ≈ descentAmbienceFloorDb (-12 dBFS) at t=1 (dome floor)', () => {
    const db = descentGainDb(1);
    // Default tunables: descentAmbienceFloorDb = -12
    expect(db).toBeCloseTo(-12, 1);
  });

  it('is strictly monotonically increasing from t=0+ to t=1', () => {
    const samples = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const values = samples.map(descentGainDb);
    for (let i = 1; i < values.length; i++) {
      const prev = values[i - 1];
      const curr = values[i];
      expect(
        curr,
        `descentGainDb should increase: at t=${samples[i]} (${curr} dB) must be > t=${samples[i - 1]} (${prev} dB)`,
      ).toBeGreaterThan(prev!);
    }
  });

  it('clamps t < 0 to 0 (returns -Infinity)', () => {
    expect(descentGainDb(-0.5)).toBe(-Infinity);
  });

  it('clamps t > 1 to 1 (same as t=1)', () => {
    expect(descentGainDb(1.5)).toBeCloseTo(descentGainDb(1), 5);
  });

  it('at t=0.5 the gain is between top and floor db values', () => {
    const db = descentGainDb(0.5);
    // Default top = -60, floor = -12 → midpoint should be between them.
    expect(db).toBeLessThan(-12);
    expect(db).toBeGreaterThan(-60);
  });
});

describe('descentLpHz', () => {
  it('returns descentAmbienceLpTopHz (400 Hz) at t=0', () => {
    expect(descentLpHz(0)).toBeCloseTo(400, 1);
  });

  it('returns descentAmbienceLpFloorHz (1600 Hz) at t=1', () => {
    expect(descentLpHz(1)).toBeCloseTo(1600, 1);
  });

  it('is strictly monotonically increasing from t=0 to t=1', () => {
    const samples = [0, 0.25, 0.5, 0.75, 1.0];
    const values = samples.map(descentLpHz);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });

  it('clamps t < 0 to top value', () => {
    expect(descentLpHz(-1)).toBeCloseTo(400, 1);
  });

  it('clamps t > 1 to floor value', () => {
    expect(descentLpHz(2)).toBeCloseTo(1600, 1);
  });

  it('at t=0.5 cutoff is between top and floor', () => {
    const hz = descentLpHz(0.5);
    expect(hz).toBeGreaterThan(400);
    expect(hz).toBeLessThan(1600);
  });
});
