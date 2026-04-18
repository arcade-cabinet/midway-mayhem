/**
 * trackGenerator unit tests — deterministic sampleTrack, sampleLookahead,
 * and laneCenterAt math.
 */
import { describe, expect, it } from 'vitest';
import { laneCenterAt, sampleLookahead, sampleTrack } from '@/track/trackGenerator';
import { TRACK } from '@/utils/constants';

describe('sampleTrack', () => {
  it('at d=0 returns origin x=0, y=0, z=0', () => {
    const s = sampleTrack(0);
    expect(s.x).toBeCloseTo(0, 6);
    expect(s.y).toBeCloseTo(0, 6);
    expect(s.z).toBeCloseTo(0, 6);
  });

  it('z always equals -d (forward = -Z)', () => {
    for (const d of [100, 500, 1337, -50]) {
      expect(sampleTrack(d).z).toBe(-d);
    }
    expect(sampleTrack(0).z).toBeCloseTo(0, 6);
  });

  it('is deterministic — same d → identical sample', () => {
    const a = sampleTrack(42.5);
    const b = sampleTrack(42.5);
    expect(a).toEqual(b);
  });

  it('tangent is a unit vector on the XZ plane', () => {
    for (const d of [0, 10, 100, 999]) {
      const t = sampleTrack(d).tangent;
      const len = Math.hypot(t.x, t.z);
      expect(len).toBeCloseTo(1, 5);
    }
  });

  it('normal is perpendicular to the tangent', () => {
    for (const d of [0, 10, 100, 999]) {
      const s = sampleTrack(d);
      const dot = s.tangent.x * s.normal.x + s.tangent.z * s.normal.z;
      expect(dot).toBeCloseTo(0, 5);
    }
  });

  it('normal has unit length (derived as perpendicular of unit tangent)', () => {
    for (const d of [0, 10, 100, 999]) {
      const n = sampleTrack(d).normal;
      const len = Math.hypot(n.x, n.z);
      expect(len).toBeCloseTo(1, 5);
    }
  });

  it('bank reads back as a finite number', () => {
    for (const d of [0, 10, 100, 500, 1337]) {
      expect(Number.isFinite(sampleTrack(d).bank)).toBe(true);
    }
  });

  it('bank at d=0 is 0 (both sine waves have zero value there)', () => {
    expect(sampleTrack(0).bank).toBeCloseTo(0, 10);
  });
});

describe('sampleLookahead', () => {
  it('returns the requested number of samples', () => {
    expect(sampleLookahead(0, 10)).toHaveLength(10);
    expect(sampleLookahead(500, 25, 4)).toHaveLength(25);
  });

  it('defaults to count=40 and step=6', () => {
    const samples = sampleLookahead(100);
    expect(samples).toHaveLength(40);
    expect(samples[0]?.d).toBe(100);
    expect(samples[1]?.d).toBe(106);
    expect(samples[39]?.d).toBe(100 + 39 * 6);
  });

  it('first sample is always at fromD', () => {
    expect(sampleLookahead(42, 5, 2)[0]?.d).toBe(42);
  });

  it('each sample.d advances by `step` from the previous', () => {
    const samples = sampleLookahead(0, 5, 3);
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1];
      const cur = samples[i];
      if (!prev || !cur) continue;
      expect(cur.d - prev.d).toBe(3);
    }
  });

  it('is deterministic — same inputs → identical array', () => {
    expect(sampleLookahead(55, 10, 5)).toEqual(sampleLookahead(55, 10, 5));
  });

  it('count=0 returns an empty array', () => {
    expect(sampleLookahead(100, 0)).toEqual([]);
  });
});

describe('laneCenterAt', () => {
  it('middle lane (LANE_COUNT=4 → lane 1.5) has zero offset from centreline', () => {
    // With LANE_COUNT=4, halfWidth = 1.5 * LANE_WIDTH. lane=1.5 would hit centre,
    // but laneIndex is an int. Use lane 1 and lane 2; their midpoint equals the centerline.
    const d = 100;
    const s = sampleTrack(d);
    const l1 = laneCenterAt(d, 1);
    const l2 = laneCenterAt(d, 2);
    const midX = (l1.x + l2.x) / 2;
    const midZ = (l1.z + l2.z) / 2;
    expect(midX).toBeCloseTo(s.x, 5);
    expect(midZ).toBeCloseTo(s.z, 5);
  });

  it('y (elevation) always matches the centerline sample.y', () => {
    for (const d of [0, 100, 500]) {
      const s = sampleTrack(d);
      for (let lane = 0; lane < TRACK.LANE_COUNT; lane++) {
        expect(laneCenterAt(d, lane).y).toBe(s.y);
      }
    }
  });

  it('lane 0 and lane (count-1) are symmetric across the centreline', () => {
    const d = 300;
    const s = sampleTrack(d);
    const leftmost = laneCenterAt(d, 0);
    const rightmost = laneCenterAt(d, TRACK.LANE_COUNT - 1);
    expect((leftmost.x + rightmost.x) / 2).toBeCloseTo(s.x, 5);
    expect((leftmost.z + rightmost.z) / 2).toBeCloseTo(s.z, 5);
  });

  it('adjacent lane centres are LANE_WIDTH apart (measured along the normal)', () => {
    const d = 400;
    const a = laneCenterAt(d, 1);
    const b = laneCenterAt(d, 2);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    expect(Math.hypot(dx, dz)).toBeCloseTo(TRACK.LANE_WIDTH, 5);
  });

  it('is deterministic — same (d, lane) → same point', () => {
    expect(laneCenterAt(150, 0)).toEqual(laneCenterAt(150, 0));
  });
});
