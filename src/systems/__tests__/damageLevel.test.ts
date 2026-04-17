import { describe, expect, it } from 'vitest';
import { damageLevelFor } from '../damageLevel';

describe('damageLevelFor', () => {
  it('returns 0 (pristine) when sanity > 70', () => {
    expect(damageLevelFor(100)).toBe(0);
    expect(damageLevelFor(71)).toBe(0);
  });

  it('returns 1 (dented) when 40 < sanity <= 70', () => {
    expect(damageLevelFor(70)).toBe(1);
    expect(damageLevelFor(55)).toBe(1);
    expect(damageLevelFor(41)).toBe(1);
  });

  it('returns 2 (bad) when 15 < sanity <= 40', () => {
    expect(damageLevelFor(40)).toBe(2);
    expect(damageLevelFor(28)).toBe(2);
    expect(damageLevelFor(16)).toBe(2);
  });

  it('returns 3 (critical) when sanity <= 15', () => {
    expect(damageLevelFor(15)).toBe(3);
    expect(damageLevelFor(7)).toBe(3);
    expect(damageLevelFor(0)).toBe(3);
  });
});
