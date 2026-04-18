/**
 * constants unit tests — pure helpers over static enum data.
 * Covers zoneForDistance wrap semantics + laneCenterX symmetry.
 */
import { describe, expect, it } from 'vitest';
import {
  HONK,
  laneCenterX,
  STEER,
  TRACK,
  ZONE_CYCLE_M,
  ZONES,
  zoneForDistance,
} from '@/utils/constants';

describe('ZONES + ZONE_CYCLE_M', () => {
  it('ZONE_CYCLE_M equals the sum of all zone lengths', () => {
    const sum = ZONES.reduce((s, z) => s + z.length, 0);
    expect(ZONE_CYCLE_M).toBe(sum);
  });

  it('zones are contiguous — each start equals previous (start + length)', () => {
    for (let i = 1; i < ZONES.length; i++) {
      const prev = ZONES[i - 1];
      const cur = ZONES[i];
      if (!prev || !cur) continue;
      expect(cur.start).toBe(prev.start + prev.length);
    }
  });
});

describe('zoneForDistance', () => {
  it('returns the first zone at d=0', () => {
    expect(zoneForDistance(0)).toBe('midway-strip');
  });

  it('returns each zone at its own start distance', () => {
    for (const z of ZONES) {
      expect(zoneForDistance(z.start)).toBe(z.id);
    }
  });

  it('returns a zone near (but before) its end boundary', () => {
    for (const z of ZONES) {
      expect(zoneForDistance(z.start + z.length - 1)).toBe(z.id);
    }
  });

  it('wraps at ZONE_CYCLE_M back to the first zone', () => {
    expect(zoneForDistance(ZONE_CYCLE_M)).toBe('midway-strip');
    expect(zoneForDistance(ZONE_CYCLE_M + 100)).toBe(zoneForDistance(100));
  });

  it('wraps negative distances into the [0, cycle) window', () => {
    expect(zoneForDistance(-1)).toBe(zoneForDistance(ZONE_CYCLE_M - 1));
    expect(zoneForDistance(-ZONE_CYCLE_M)).toBe(zoneForDistance(0));
  });

  it('is deterministic — same d always produces the same zone', () => {
    for (const d of [0, 100, 450, 899, 1000, 1799]) {
      expect(zoneForDistance(d)).toBe(zoneForDistance(d));
    }
  });
});

describe('TRACK geometry', () => {
  it('WIDTH = LANE_COUNT * LANE_WIDTH', () => {
    expect(TRACK.WIDTH).toBeCloseTo(TRACK.LANE_COUNT * TRACK.LANE_WIDTH, 6);
  });

  it('HALF_WIDTH is half of WIDTH', () => {
    expect(TRACK.HALF_WIDTH).toBeCloseTo(TRACK.WIDTH / 2, 6);
  });

  it('LATERAL_CLAMP is HALF_WIDTH minus a 0.5m safety margin', () => {
    expect(TRACK.LATERAL_CLAMP).toBeCloseTo(TRACK.HALF_WIDTH - 0.5, 6);
  });

  it('LANE_COUNT stays ≥ 3 (design rule: always ≥ 3 lanes)', () => {
    expect(TRACK.LANE_COUNT).toBeGreaterThanOrEqual(3);
  });
});

describe('laneCenterX', () => {
  it('is symmetric around lane midpoint', () => {
    const leftmost = laneCenterX(0);
    const rightmost = laneCenterX(TRACK.LANE_COUNT - 1);
    expect(leftmost).toBeCloseTo(-rightmost, 6);
  });

  it('spacing between adjacent lanes equals LANE_WIDTH', () => {
    for (let i = 1; i < TRACK.LANE_COUNT; i++) {
      expect(laneCenterX(i) - laneCenterX(i - 1)).toBeCloseTo(TRACK.LANE_WIDTH, 6);
    }
  });

  it('all lane centres stay inside LATERAL_CLAMP', () => {
    for (let i = 0; i < TRACK.LANE_COUNT; i++) {
      expect(Math.abs(laneCenterX(i))).toBeLessThanOrEqual(TRACK.LATERAL_CLAMP);
    }
  });

  it('returns linear function of lane index', () => {
    // laneCenterX(i) = (i - (count-1)/2) * LANE_WIDTH
    const half = (TRACK.LANE_COUNT - 1) / 2;
    expect(laneCenterX(0)).toBeCloseTo(-half * TRACK.LANE_WIDTH, 6);
    expect(laneCenterX(TRACK.LANE_COUNT - 1)).toBeCloseTo(half * TRACK.LANE_WIDTH, 6);
  });
});

describe('HONK + STEER constants', () => {
  it('HONK values are positive and finite', () => {
    expect(HONK.SCARE_RADIUS_M).toBeGreaterThan(0);
    expect(HONK.FLEE_LATERAL_M).toBeGreaterThan(0);
    expect(HONK.FLEE_DURATION_S).toBeGreaterThan(0);
    expect(HONK.COOLDOWN_S).toBeGreaterThan(0);
  });

  it('STEER values are positive and finite', () => {
    expect(STEER.MAX_LATERAL_MPS).toBeGreaterThan(0);
    expect(STEER.RETURN_TAU_S).toBeGreaterThan(0);
    expect(STEER.WHEEL_MAX_DEG).toBeGreaterThan(0);
    expect(STEER.SENSITIVITY).toBeGreaterThan(0);
  });
});
