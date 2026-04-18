/**
 * ghost unit tests — covers sampleGhost interpolation, clamping, and
 * binary-search correctness. The recorder + localStorage persistence
 * path is exercised by the persistence integration test; these tests
 * focus on the pure time→(distance,lateral) lookup.
 */
import { describe, expect, it } from 'vitest';
import { type GhostRecord, sampleGhost } from '@/game/ghost';

function ghost(samples: Array<{ t: number; distance: number; lateral: number }>): GhostRecord {
  return { score: 0, createdAt: 0, samples };
}

describe('sampleGhost', () => {
  it('returns null for an empty ghost', () => {
    expect(sampleGhost(ghost([]), 0)).toBeNull();
  });

  it('clamps times before the first sample', () => {
    const g = ghost([
      { t: 1, distance: 10, lateral: 0 },
      { t: 2, distance: 20, lateral: 0 },
    ]);
    const r = sampleGhost(g, 0);
    expect(r).toEqual({ distance: 10, lateral: 0 });
  });

  it('clamps times after the last sample', () => {
    const g = ghost([
      { t: 1, distance: 10, lateral: 0 },
      { t: 2, distance: 20, lateral: 0 },
    ]);
    const r = sampleGhost(g, 99);
    expect(r).toEqual({ distance: 20, lateral: 0 });
  });

  it('interpolates linearly between two bracketing samples', () => {
    const g = ghost([
      { t: 0, distance: 0, lateral: -1 },
      { t: 1, distance: 10, lateral: 1 },
    ]);
    const r = sampleGhost(g, 0.5);
    expect(r?.distance).toBeCloseTo(5, 6);
    expect(r?.lateral).toBeCloseTo(0, 6);
  });

  it('finds the right bracket across many samples via binary search', () => {
    const samples = [];
    for (let i = 0; i <= 100; i++) {
      samples.push({ t: i, distance: i * 2, lateral: i * 0.1 });
    }
    const g = ghost(samples);
    const r = sampleGhost(g, 42.3);
    expect(r?.distance).toBeCloseTo(84.6, 4);
    expect(r?.lateral).toBeCloseTo(4.23, 4);
  });

  it('returns exact sample value when t matches a sample time', () => {
    const g = ghost([
      { t: 0, distance: 0, lateral: 0 },
      { t: 5, distance: 50, lateral: 2 },
      { t: 10, distance: 100, lateral: -2 },
    ]);
    const r = sampleGhost(g, 5);
    expect(r?.distance).toBeCloseTo(50, 6);
    expect(r?.lateral).toBeCloseTo(2, 6);
  });
});
