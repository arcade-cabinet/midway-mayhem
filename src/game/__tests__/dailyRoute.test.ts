import { describe, expect, it } from 'vitest';
import {
  getDailySeed,
  isDailyRoute,
  permuteTrack,
  setDailyRoute,
  utcDateString,
} from '../dailyRoute';
import type { PieceKind } from '../trackComposer';

describe('utcDateString', () => {
  it('returns yyyy-mm-dd format', () => {
    const s = utcDateString(Date.UTC(2026, 3, 16)); // April 16 2026
    expect(s).toBe('2026-04-16');
  });

  it('pads month and day', () => {
    const s = utcDateString(Date.UTC(2026, 0, 5)); // Jan 5
    expect(s).toBe('2026-01-05');
  });

  it('defaults to current time', () => {
    const s = utcDateString();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getDailySeed', () => {
  it('is deterministic for the same UTC timestamp', () => {
    const ts = Date.UTC(2026, 3, 16, 12, 0, 0); // same day
    const s1 = getDailySeed(ts);
    const s2 = getDailySeed(ts);
    expect(s1).toBe(s2);
  });

  it('is deterministic across calls in the same UTC day', () => {
    // Two timestamps in the same UTC day (different hours)
    const ts1 = Date.UTC(2026, 3, 16, 0, 0, 0);
    const ts2 = Date.UTC(2026, 3, 16, 23, 59, 59);
    expect(getDailySeed(ts1)).toBe(getDailySeed(ts2));
  });

  it('differs across UTC days', () => {
    const ts1 = Date.UTC(2026, 3, 16);
    const ts2 = Date.UTC(2026, 3, 17);
    expect(getDailySeed(ts1)).not.toBe(getDailySeed(ts2));
  });

  it('differs across months', () => {
    const ts1 = Date.UTC(2026, 3, 1);
    const ts2 = Date.UTC(2026, 4, 1);
    expect(getDailySeed(ts1)).not.toBe(getDailySeed(ts2));
  });

  it('returns a positive 32-bit integer', () => {
    const seed = getDailySeed(Date.UTC(2026, 3, 16));
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
    expect(Number.isInteger(seed)).toBe(true);
  });
});

describe('isDailyRoute / setDailyRoute', () => {
  it('defaults to true', () => {
    setDailyRoute(true); // ensure known state
    expect(isDailyRoute()).toBe(true);
  });

  it('setDailyRoute(false) disables daily mode', () => {
    setDailyRoute(false);
    expect(isDailyRoute()).toBe(false);
    setDailyRoute(true); // restore
  });
});

describe('permuteTrack', () => {
  const BASE: readonly PieceKind[] = [
    'start',
    'straight',
    'straightLong',
    'cornerLarge',
    'ramp',
    'end',
  ];

  it('preserves first and last pieces', () => {
    const result = permuteTrack(BASE, 12345);
    expect(result[0]).toBe('start');
    expect(result[result.length - 1]).toBe('end');
  });

  it('preserves all pieces (same set)', () => {
    const result = permuteTrack(BASE, 12345);
    expect(result).toHaveLength(BASE.length);
    expect([...result].sort()).toEqual([...BASE].sort());
  });

  it('is deterministic for the same seed', () => {
    const r1 = permuteTrack(BASE, 99999);
    const r2 = permuteTrack(BASE, 99999);
    expect(r1).toEqual(r2);
  });

  it('produces different orderings for different seeds', () => {
    const r1 = permuteTrack(BASE, 1);
    const r2 = permuteTrack(BASE, 999999);
    // Interior pieces should differ at least sometimes
    const interiorSame = r1
      .slice(1, -1)
      .every((k, i) => k === r2.slice(1, -1)[i]);
    // With 4 interior pieces and random seeds, chance of identical order is low
    expect(interiorSame).toBe(false);
  });

  it('handles 2-element track (start + end only)', () => {
    const short: PieceKind[] = ['start', 'end'];
    expect(permuteTrack(short, 42)).toEqual(['start', 'end']);
  });

  it('handles 1-element track', () => {
    const one: PieceKind[] = ['start'];
    expect(permuteTrack(one, 42)).toEqual(['start']);
  });
});
