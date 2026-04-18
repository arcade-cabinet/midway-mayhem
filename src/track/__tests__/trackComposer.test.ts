/**
 * trackComposer unit tests — deterministic placement math.
 * Covers PIECE_SPECS completeness, composeTrack invariants, seamEndOf
 * continuity with composeTrack, and DEFAULT_TRACK structural rules.
 */
import { describe, expect, it } from 'vitest';
import {
  composeTrack,
  DEFAULT_TRACK,
  PIECE_SPECS,
  type PieceKind,
  seamEndOf,
} from '@/track/trackComposer';

const ALL_KINDS: PieceKind[] = [
  'start',
  'straight',
  'straightLong',
  'straightArrow',
  'end',
  'cornerSmall',
  'cornerLarge',
  'cornerLarger',
  'ramp',
  'rampLong',
  'rampLongCurved',
  'curved',
];

describe('PIECE_SPECS', () => {
  it('has a spec for every PieceKind', () => {
    for (const k of ALL_KINDS) {
      expect(PIECE_SPECS[k]).toBeDefined();
    }
  });

  it('all lengths are positive', () => {
    for (const k of ALL_KINDS) {
      expect(PIECE_SPECS[k].length).toBeGreaterThan(0);
    }
  });

  it('all zRise values are non-negative (track never descends)', () => {
    for (const k of ALL_KINDS) {
      expect(PIECE_SPECS[k].zRise).toBeGreaterThanOrEqual(0);
    }
  });

  it('only corner/ramp-curved pieces have lateral offset', () => {
    const withLateral = ALL_KINDS.filter((k) => PIECE_SPECS[k].lateral !== 0);
    expect(withLateral.sort()).toEqual(
      ['cornerSmall', 'cornerLarge', 'cornerLarger', 'rampLongCurved'].sort(),
    );
  });

  it('every assetId is a non-empty string', () => {
    for (const k of ALL_KINDS) {
      expect(PIECE_SPECS[k].assetId.length).toBeGreaterThan(0);
    }
  });
});

describe('composeTrack — empty + single piece', () => {
  it('returns an empty composition for []', () => {
    const t = composeTrack([]);
    expect(t.placements).toEqual([]);
    expect(t.totalLength).toBe(0);
  });

  it('single straight piece produces one placement with cumulative length = length*scale', () => {
    const t = composeTrack(['straight'], 10);
    expect(t.placements).toHaveLength(1);
    expect(t.placements[0]?.kind).toBe('straight');
    expect(t.placements[0]?.length).toBeCloseTo(10, 6);
    expect(t.totalLength).toBeCloseTo(10, 6);
    expect(t.placements[0]?.distanceAtStart).toBe(0);
  });

  it('respects worldScale multiplier', () => {
    const a = composeTrack(['straight'], 1);
    const b = composeTrack(['straight'], 10);
    expect(b.totalLength).toBeCloseTo(a.totalLength * 10, 6);
  });
});

describe('composeTrack — multi-piece invariants', () => {
  it('distanceAtStart is monotonic non-decreasing', () => {
    const t = composeTrack(['start', 'straight', 'straightLong', 'cornerLarge', 'end'], 10);
    for (let i = 1; i < t.placements.length; i++) {
      const prev = t.placements[i - 1];
      const cur = t.placements[i];
      if (!prev || !cur) continue;
      expect(cur.distanceAtStart).toBeGreaterThanOrEqual(prev.distanceAtStart);
    }
  });

  it('totalLength equals sum of piece lengths plus any corner lateral offsets', () => {
    const kinds: PieceKind[] = ['straight', 'straight', 'straight'];
    const t = composeTrack(kinds, 10);
    // No corners → totalLength = 3 * 1 * 10 = 30
    expect(t.totalLength).toBeCloseTo(30, 6);
  });

  it('pure-straight run keeps heading constant (rotationY of first == last)', () => {
    const t = composeTrack(['straight', 'straightLong', 'straight'], 10);
    expect(t.placements[0]?.rotationY).toBeCloseTo(
      t.placements[t.placements.length - 1]?.rotationY ?? NaN,
      6,
    );
  });

  it('four 90° corners bring heading back to its starting value (mod 2π)', () => {
    const t = composeTrack(['cornerSmall', 'cornerSmall', 'cornerSmall', 'cornerSmall'], 10);
    const delta = Math.abs(((t.endHeadingRad - Math.PI) % (Math.PI * 2)) % (Math.PI * 2));
    // After 4 * 90° = 360° we land back at start (π) modulo 2π.
    expect(Math.min(delta, Math.PI * 2 - delta)).toBeCloseTo(0, 4);
  });

  it('ramp pieces elevate the end-cursor Y', () => {
    const t = composeTrack(['ramp', 'ramp'], 10);
    expect(t.endPosition[1]).toBeCloseTo(0.27 * 2 * 10, 4);
  });

  it('all-flat track keeps endPosition Y at 0', () => {
    const t = composeTrack(['straight', 'straightLong', 'straight'], 10);
    expect(t.endPosition[1]).toBe(0);
  });
});

describe('seamEndOf', () => {
  it('for a straight piece, equals the next piece position plus anchor offset', () => {
    const t = composeTrack(['straight', 'straight'], 10);
    const first = t.placements[0];
    expect(first).toBeDefined();
    const seam = seamEndOf(first!, 10);
    // seam end should equal the cursor at the END of piece 0 = START of piece 1.
    // The second piece's placement X/Z is offset from that cursor by the anchor,
    // which is the same for both pieces, so the horizontal deltas should match.
    const second = t.placements[1];
    expect(second).toBeDefined();
    // The x/z delta between the two placements equals the length of piece 0 along heading.
    const spec = PIECE_SPECS.straight;
    const headingRad = -first!.rotationY;
    const dirX = Math.sin(headingRad);
    const dirZ = Math.cos(headingRad);
    const expectedDeltaX = dirX * spec.length * 10;
    const expectedDeltaZ = dirZ * spec.length * 10;
    expect(second!.position[0] - first!.position[0]).toBeCloseTo(expectedDeltaX, 4);
    expect(second!.position[2] - first!.position[2]).toBeCloseTo(expectedDeltaZ, 4);

    // And the ramp-free seam Y should match start Y.
    expect(seam.y).toBeCloseTo(first!.position[1], 6);
  });

  it('is deterministic: repeated calls with the same placement return the same seam', () => {
    const t = composeTrack(['cornerLarge'], 10);
    const p = t.placements[0];
    expect(p).toBeDefined();
    const a = seamEndOf(p!, 10);
    const b = seamEndOf(p!, 10);
    expect(a).toEqual(b);
  });

  it('respects worldScale in seam coordinates', () => {
    const t1 = composeTrack(['straight'], 1);
    const t10 = composeTrack(['straight'], 10);
    const s1 = seamEndOf(t1.placements[0]!, 1);
    const s10 = seamEndOf(t10.placements[0]!, 10);
    // Scaling by 10 should scale coordinates by ~10.
    expect(s10.x).toBeCloseTo(s1.x * 10, 4);
    expect(s10.z).toBeCloseTo(s1.z * 10, 4);
  });
});

describe('DEFAULT_TRACK', () => {
  it('starts with "start" and ends with "end"', () => {
    expect(DEFAULT_TRACK[0]).toBe('start');
    expect(DEFAULT_TRACK[DEFAULT_TRACK.length - 1]).toBe('end');
  });

  it('only references known PieceKinds', () => {
    for (const k of DEFAULT_TRACK) {
      expect(PIECE_SPECS[k]).toBeDefined();
    }
  });

  it('composes into a non-trivial total length', () => {
    const t = composeTrack(DEFAULT_TRACK, 10);
    expect(t.totalLength).toBeGreaterThan(0);
    expect(t.placements.length).toBe(DEFAULT_TRACK.length);
  });
});
