import { describe, expect, it } from 'vitest';
import { tunables } from '@/config';
import { damageLevelFor } from '@/game/damageLevel';

describe('damageLevelFor', () => {
  const { pristineThreshold, dentedThreshold, badThreshold } = tunables.damage;

  it('returns 0 pristine when sanity is well above the pristine threshold', () => {
    expect(damageLevelFor(100)).toBe(0);
    expect(damageLevelFor(pristineThreshold + 10)).toBe(0);
  });

  it('returns 1 dented when sanity sits between the dented and pristine thresholds', () => {
    expect(damageLevelFor(pristineThreshold)).toBe(1);
    expect(damageLevelFor(dentedThreshold + 1)).toBe(1);
  });

  it('returns 2 bad when sanity sits between the bad and dented thresholds', () => {
    expect(damageLevelFor(dentedThreshold)).toBe(2);
    expect(damageLevelFor(badThreshold + 1)).toBe(2);
  });

  it('returns 3 critical at or below the bad threshold', () => {
    expect(damageLevelFor(badThreshold)).toBe(3);
    expect(damageLevelFor(0)).toBe(3);
  });

  it('throws on negative sanity', () => {
    expect(() => damageLevelFor(-1)).toThrow(/Invalid sanity/);
  });

  it('throws on non-finite sanity (NaN / Infinity)', () => {
    expect(() => damageLevelFor(Number.NaN)).toThrow(/Invalid sanity/);
    expect(() => damageLevelFor(Number.POSITIVE_INFINITY)).toThrow(/Invalid sanity/);
    expect(() => damageLevelFor(Number.NEGATIVE_INFINITY)).toThrow(/Invalid sanity/);
  });
});
