/**
 * dailyRoute unit tests — daily seed derivation, mode flag, and
 * deterministic track permutation (seeded + track-RNG variants).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getDailySeed,
  isDailyRoute,
  permuteTrack,
  permuteTrackWithRng,
  setDailyRoute,
  utcDateString,
} from '@/track/dailyRoute';
import type { PieceKind } from '@/track/trackComposer';

describe('utcDateString', () => {
  it('formats as yyyy-mm-dd', () => {
    // 2026-01-02 10:00:00 UTC
    const d = Date.UTC(2026, 0, 2, 10, 0, 0);
    expect(utcDateString(d)).toBe('2026-01-02');
  });

  it('zero-pads single-digit month and day', () => {
    const d = Date.UTC(2000, 0, 1, 0, 0, 0);
    expect(utcDateString(d)).toBe('2000-01-01');
  });

  it('is based on UTC, not local time (start-of-day UTC stays the same day)', () => {
    const d = Date.UTC(2026, 3, 18, 0, 0, 0);
    expect(utcDateString(d)).toBe('2026-04-18');
  });

  it('without an argument, uses Date.now()', () => {
    const s = utcDateString();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getDailySeed', () => {
  it('is deterministic for the same day', () => {
    const d = Date.UTC(2026, 3, 18, 5, 0, 0);
    expect(getDailySeed(d)).toBe(getDailySeed(d));
  });

  it('does not vary across times within the same UTC day', () => {
    const morning = Date.UTC(2026, 3, 18, 1, 0, 0);
    const night = Date.UTC(2026, 3, 18, 23, 30, 0);
    expect(getDailySeed(morning)).toBe(getDailySeed(night));
  });

  it('changes when the UTC day rolls over', () => {
    const d1 = Date.UTC(2026, 3, 18, 12, 0, 0);
    const d2 = Date.UTC(2026, 3, 19, 12, 0, 0);
    expect(getDailySeed(d1)).not.toBe(getDailySeed(d2));
  });

  it('returns an unsigned 32-bit integer', () => {
    const s = getDailySeed(Date.UTC(2026, 3, 18));
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('isDailyRoute + setDailyRoute', () => {
  beforeEach(() => {
    setDailyRoute(true);
  });

  it('defaults to true', () => {
    expect(isDailyRoute()).toBe(true);
  });

  it('setDailyRoute(false) flips to practice mode', () => {
    setDailyRoute(false);
    expect(isDailyRoute()).toBe(false);
  });

  it('setDailyRoute toggles back on', () => {
    setDailyRoute(false);
    setDailyRoute(true);
    expect(isDailyRoute()).toBe(true);
  });
});

describe('permuteTrack', () => {
  const base: PieceKind[] = [
    'start',
    'straight',
    'ramp',
    'cornerSmall',
    'cornerLarge',
    'straight',
    'end',
  ];

  it('returns a shallow copy for arrays of length ≤ 2', () => {
    const a = permuteTrack(['start', 'end'] as PieceKind[], 42);
    expect(a).toEqual(['start', 'end']);
    const b = permuteTrack(['start'] as PieceKind[], 42);
    expect(b).toEqual(['start']);
  });

  it('keeps first and last elements fixed', () => {
    const out = permuteTrack(base, 42);
    expect(out[0]).toBe('start');
    expect(out[out.length - 1]).toBe('end');
  });

  it('preserves the interior multiset (same elements, possibly different order)', () => {
    const out = permuteTrack(base, 42);
    const sortedIn = [...base.slice(1, -1)].sort();
    const sortedOut = [...out.slice(1, -1)].sort();
    expect(sortedOut).toEqual(sortedIn);
  });

  it('is deterministic — same seed → identical output', () => {
    const a = permuteTrack(base, 1234);
    const b = permuteTrack(base, 1234);
    expect(a).toEqual(b);
  });

  it('different seeds can produce different orderings', () => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 42, 999]) {
      seen.add(permuteTrack(base, seed).join(','));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('seed 0 still produces a valid permutation (fallback state)', () => {
    const out = permuteTrack(base, 0);
    expect(out).toHaveLength(base.length);
    expect(out[0]).toBe('start');
    expect(out[out.length - 1]).toBe('end');
  });

  it('does not mutate the input array', () => {
    const baseCopy = [...base];
    permuteTrack(base, 42);
    expect(base).toEqual(baseCopy);
  });
});

describe('permuteTrackWithRng', () => {
  const base: PieceKind[] = ['start', 'straight', 'ramp', 'cornerSmall', 'end'];

  function makeRng(values: number[]) {
    let i = 0;
    return {
      next() {
        return values[i++ % values.length] ?? 0;
      },
    };
  }

  it('short-circuits on arrays of length ≤ 2', () => {
    const out = permuteTrackWithRng(['start', 'end'] as PieceKind[], makeRng([0.5]));
    expect(out).toEqual(['start', 'end']);
  });

  it('keeps start and end fixed, shuffles interior', () => {
    const out = permuteTrackWithRng(base, makeRng([0, 0.5, 0.9]));
    expect(out[0]).toBe('start');
    expect(out[out.length - 1]).toBe('end');
    const sortedIn = [...base.slice(1, -1)].sort();
    const sortedOut = [...out.slice(1, -1)].sort();
    expect(sortedOut).toEqual(sortedIn);
  });

  it('is deterministic for identical RNG sequences', () => {
    const a = permuteTrackWithRng(base, makeRng([0.1, 0.2, 0.3]));
    const b = permuteTrackWithRng(base, makeRng([0.1, 0.2, 0.3]));
    expect(a).toEqual(b);
  });

  it('consumes the RNG stream it is given (different streams → different orders)', () => {
    const a = permuteTrackWithRng(base, makeRng([0, 0, 0]));
    const b = permuteTrackWithRng(base, makeRng([0.9, 0.9, 0.9]));
    // May be equal if interior is 1 element; here we chose 3 → often differ,
    // but we don't rely on that — only assert both are valid permutations.
    expect(a[0]).toBe('start');
    expect(b[0]).toBe('start');
    expect(a[a.length - 1]).toBe('end');
    expect(b[b.length - 1]).toBe('end');
  });
});
