import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_GRID,
  DIFFICULTY_PROFILES,
  effectivePermadeath,
} from '@/game/difficulty';

describe('difficulty model', () => {
  it('has exactly 6 tiers arranged as 3×2', () => {
    expect(DIFFICULTY_GRID.length).toBe(3);
    for (const row of DIFFICULTY_GRID) expect(row.length).toBe(2);
    const flat = DIFFICULTY_GRID.flat();
    expect(flat.length).toBe(6);
    expect(new Set(flat).size).toBe(6);
  });

  it('target speed is monotonically non-decreasing down the ladder', () => {
    const flat = DIFFICULTY_GRID.flat();
    const speeds = flat.map((id) => DIFFICULTY_PROFILES[id].targetSpeedMps);
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i - 1] as number);
    }
  });

  it('reward multiplier is monotonically non-decreasing', () => {
    const flat = DIFFICULTY_GRID.flat();
    const rewards = flat.map((id) => DIFFICULTY_PROFILES[id].rewardMultiplier);
    for (let i = 1; i < rewards.length; i++) {
      expect(rewards[i]).toBeGreaterThanOrEqual(rewards[i - 1] as number);
    }
  });

  it('only nightmare + ultra-nightmare support permadeath', () => {
    for (const [id, profile] of Object.entries(DIFFICULTY_PROFILES)) {
      if (id === 'nightmare' || id === 'ultra-nightmare') {
        expect(profile.supportsPermadeath).toBe(true);
      } else {
        expect(profile.supportsPermadeath).toBe(false);
      }
    }
  });

  it('only ultra-nightmare forces permadeath on', () => {
    for (const [id, profile] of Object.entries(DIFFICULTY_PROFILES)) {
      expect(profile.forcesPermadeath).toBe(id === 'ultra-nightmare');
    }
  });

  it('effectivePermadeath: always false for easier tiers regardless of toggle', () => {
    expect(effectivePermadeath('silly', true)).toBe(false);
    expect(effectivePermadeath('kazoo', true)).toBe(false);
    expect(effectivePermadeath('plenty', true)).toBe(false);
    expect(effectivePermadeath('ultra-honk', true)).toBe(false);
  });

  it('effectivePermadeath: respects toggle on nightmare', () => {
    expect(effectivePermadeath('nightmare', false)).toBe(false);
    expect(effectivePermadeath('nightmare', true)).toBe(true);
  });

  it('effectivePermadeath: always true on ultra-nightmare', () => {
    expect(effectivePermadeath('ultra-nightmare', false)).toBe(true);
    expect(effectivePermadeath('ultra-nightmare', true)).toBe(true);
  });

  it('DEFAULT_DIFFICULTY is a valid tier', () => {
    expect(DIFFICULTY_PROFILES[DEFAULT_DIFFICULTY]).toBeDefined();
  });
});
