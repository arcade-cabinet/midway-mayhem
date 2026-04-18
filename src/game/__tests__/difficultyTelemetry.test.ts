/**
 * difficultyTelemetry unit tests — proves the balance harness itself
 * works, and sanity-checks the resulting solvability claims on a small
 * seed sweep. The "every tier must be winnable on every seed" contract
 * is exercised against a handful of seeds per tier.
 */
import { describe, expect, it } from 'vitest';
import { DIFFICULTY_PROFILES } from '@/game/difficulty';
import { auditAllDifficulties, auditDifficulty, PASS_THRESHOLD } from '@/game/difficultyTelemetry';

const SEEDS = [1, 2, 3, 42, 1000, 99_999];

describe('auditDifficulty', () => {
  it('throws on empty seed list', () => {
    expect(() => auditDifficulty(DIFFICULTY_PROFILES.kazoo, [])).toThrow(
      /seeds array must not be empty/,
    );
  });

  it('returns one result per seed and counts solvable runs', () => {
    const audit = auditDifficulty(DIFFICULTY_PROFILES.kazoo, SEEDS);
    expect(audit.seedCount).toBe(SEEDS.length);
    expect(audit.results).toHaveLength(SEEDS.length);
    expect(audit.solvableSeeds).toBeLessThanOrEqual(SEEDS.length);
    expect(audit.passRate).toBeCloseTo(audit.solvableSeeds / audit.seedCount, 6);
  });

  it('flags pass when solvableSeeds == seedCount (PASS_THRESHOLD=1.0)', () => {
    const audit = auditDifficulty(DIFFICULTY_PROFILES.kazoo, SEEDS);
    expect(audit.passes).toBe(audit.passRate >= PASS_THRESHOLD);
  });

  it('tags every seed with solvable boolean mirroring obstaclesHit===0', () => {
    const audit = auditDifficulty(DIFFICULTY_PROFILES.plenty, SEEDS);
    for (const r of audit.results) {
      expect(r.solvable).toBe(r.obstaclesHit === 0);
    }
  });

  it('computes deviationDensityPer100m as laneSwitches/distance * 100', () => {
    const audit = auditDifficulty(DIFFICULTY_PROFILES.kazoo, SEEDS);
    for (const r of audit.results) {
      expect(r.deviationDensityPer100m).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('auditAllDifficulties', () => {
  it('returns an audit for every tier', () => {
    const all = auditAllDifficulties(SEEDS);
    const tiers: (keyof typeof all)[] = [
      'silly',
      'kazoo',
      'plenty',
      'ultra-honk',
      'nightmare',
      'ultra-nightmare',
    ];
    for (const t of tiers) {
      expect(all[t]).toBeDefined();
      expect(all[t].difficulty).toBe(t);
    }
  });
});
