/**
 * Difficulty tier unit tests — permadeath logic + profile structural
 * invariants. Catches regressions that would let a player toggle
 * permadeath off on ULTRA NIGHTMARE, or fail to recognise the grid
 * layout shape the NewRun modal depends on.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_GRID,
  DIFFICULTY_PROFILES,
  type Difficulty,
  effectivePermadeath,
} from '@/game/difficulty';

const ALL_DIFFICULTIES: Difficulty[] = [
  'silly',
  'kazoo',
  'plenty',
  'ultra-honk',
  'nightmare',
  'ultra-nightmare',
];

describe('effectivePermadeath', () => {
  it('ultra-nightmare forces permadeath on, regardless of the toggle', () => {
    expect(effectivePermadeath('ultra-nightmare', false)).toBe(true);
    expect(effectivePermadeath('ultra-nightmare', true)).toBe(true);
  });

  it('nightmare respects the user toggle', () => {
    expect(effectivePermadeath('nightmare', false)).toBe(false);
    expect(effectivePermadeath('nightmare', true)).toBe(true);
  });

  it('easier tiers always return false', () => {
    for (const tier of ['silly', 'kazoo', 'plenty', 'ultra-honk'] as const) {
      expect(effectivePermadeath(tier, true)).toBe(false);
      expect(effectivePermadeath(tier, false)).toBe(false);
    }
  });
});

describe('DIFFICULTY_PROFILES', () => {
  it('exposes a profile for every difficulty in the enum', () => {
    for (const tier of ALL_DIFFICULTIES) {
      const p = DIFFICULTY_PROFILES[tier];
      expect(p, `missing profile for ${tier}`).toBeDefined();
      expect(p.id).toBe(tier);
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.targetSpeedMps).toBeGreaterThan(0);
    }
  });

  it('target speed monotonically increases across tiers', () => {
    const speeds = ALL_DIFFICULTIES.map((id) => DIFFICULTY_PROFILES[id].targetSpeedMps);
    for (let i = 1; i < speeds.length; i++) {
      expect(
        speeds[i],
        `${ALL_DIFFICULTIES[i]} (${speeds[i]}) should be faster than ${ALL_DIFFICULTIES[i - 1]} (${speeds[i - 1]})`,
      ).toBeGreaterThan(speeds[i - 1]!);
    }
  });

  it('reward multiplier monotonically increases across tiers', () => {
    const rewards = ALL_DIFFICULTIES.map((id) => DIFFICULTY_PROFILES[id].rewardMultiplier);
    for (let i = 1; i < rewards.length; i++) {
      expect(rewards[i]).toBeGreaterThan(rewards[i - 1]!);
    }
  });
});

describe('DIFFICULTY_GRID', () => {
  it('is a 3×2 grid covering every difficulty exactly once', () => {
    expect(DIFFICULTY_GRID.length).toBe(3);
    for (const row of DIFFICULTY_GRID) {
      expect(row.length).toBe(2);
    }
    const flat = DIFFICULTY_GRID.flat();
    expect(flat.length).toBe(ALL_DIFFICULTIES.length);
    const seen = new Set(flat);
    expect(seen.size).toBe(ALL_DIFFICULTIES.length);
    for (const tier of ALL_DIFFICULTIES) {
      expect(seen.has(tier), `grid missing ${tier}`).toBe(true);
    }
  });
});

describe('DEFAULT_DIFFICULTY', () => {
  it('is a valid tier that exists in the profiles map', () => {
    expect(DIFFICULTY_PROFILES[DEFAULT_DIFFICULTY]).toBeDefined();
  });
});
