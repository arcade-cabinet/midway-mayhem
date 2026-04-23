/**
 * A-DESC-5 node tests — audience placement helper.
 *
 * Pure logic: no Three.js, no DOM, no GPU.
 * Validates radial band, height band, determinism, and palette invariants.
 */
import { describe, expect, it } from 'vitest';
import { AUDIENCE_PALETTE, audiencePositions } from '../audiencePositions';

const SEED = 0xad13; // Same constant as Audience.tsx

describe('audiencePositions', () => {
  it('returns exactly `count` positions', () => {
    expect(audiencePositions(SEED, 2000)).toHaveLength(2000);
    expect(audiencePositions(SEED, 10)).toHaveLength(10);
  });

  it('all positions have radius in [60, 120] m', () => {
    const positions = audiencePositions(SEED, 2000);
    for (const p of positions) {
      const r = Math.sqrt(p.x * p.x + p.z * p.z);
      expect(r, `radius out of band: r=${r.toFixed(2)}`).toBeGreaterThanOrEqual(60);
      expect(r, `radius out of band: r=${r.toFixed(2)}`).toBeLessThanOrEqual(120);
    }
  });

  it('all positions have y in [5, ~22] m (base 5-18 + row tier ≤ 4×1.2)', () => {
    const positions = audiencePositions(SEED, 2000);
    const MIN_Y = 5;
    const MAX_Y = 18 + 4 * 1.2 + 0.001; // generous ceiling
    for (const p of positions) {
      expect(p.y, `y=${p.y.toFixed(2)} out of band`).toBeGreaterThanOrEqual(MIN_Y);
      expect(p.y, `y=${p.y.toFixed(2)} out of band`).toBeLessThan(MAX_Y);
    }
  });

  it('is deterministic — same seed produces identical positions', () => {
    const a = audiencePositions(SEED, 2000);
    const b = audiencePositions(SEED, 2000);

    // Compare first, middle, and last to catch state-reset bugs without
    // a full deep-equal (which is slow for 2000 objects).
    expect(a[0]).toEqual(b[0]);
    expect(a[999]).toEqual(b[999]);
    expect(a[1999]).toEqual(b[1999]);
  });

  it('different seeds produce different first positions', () => {
    const a = audiencePositions(SEED, 100);
    const b = audiencePositions(SEED + 1, 100);
    expect(a[0]!.x).not.toBeCloseTo(b[0]!.x, 5);
  });

  it('bobPhase is spread across [0, 2π) — no two adjacent instances are in lockstep', () => {
    const positions = audiencePositions(SEED, 10);
    const phases = positions.map((p) => p.bobPhase);
    // Each step should differ by 2π/count = 2π/10 ≈ 0.628
    const expected = (Math.PI * 2) / 10;
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]! - phases[i - 1]!).toBeCloseTo(expected, 5);
    }
  });

  it('colors cycle through AUDIENCE_PALETTE', () => {
    const positions = audiencePositions(SEED, AUDIENCE_PALETTE.length * 2);
    for (let i = 0; i < positions.length; i++) {
      expect(positions[i]!.color).toBe(AUDIENCE_PALETTE[i % AUDIENCE_PALETTE.length]);
    }
  });
});

describe('AUDIENCE_PALETTE', () => {
  it('has exactly 5 brand colors', () => {
    expect(AUDIENCE_PALETTE).toHaveLength(5);
  });

  it('every entry is a 7-char hex string', () => {
    for (const hex of AUDIENCE_PALETTE) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('matches STANDARDS.md brand palette verbatim (case-insensitive)', () => {
    const expected = ['#E53935', '#FFD600', '#1E88E5', '#8E24AA', '#F36F21'].map((c) =>
      c.toLowerCase(),
    );
    const actual = [...AUDIENCE_PALETTE].map((c) => c.toLowerCase());
    expect(actual).toEqual(expected);
  });
});
