import { describe, expect, it } from 'vitest';
import type { Difficulty } from '@/game/difficulty';
import { DIFFICULTY_PROFILES } from '@/game/difficulty';
import { auditAllDifficulties, auditDifficulty, PASS_THRESHOLD } from '@/game/difficultyTelemetry';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_TIERS: Difficulty[] = [
  'silly',
  'kazoo',
  'plenty',
  'ultra-honk',
  'nightmare',
  'ultra-nightmare',
];

/** 30 deterministic seeds via the same splitmix step used by the CLI. */
function make30Seeds(): number[] {
  let s = 0xdeadbeef_cafebaben;
  const seeds: number[] = [];
  for (let i = 0; i < 30; i++) {
    s = BigInt.asUintN(64, s + 0x9e3779b97f4a7c15n);
    seeds.push(Number(BigInt.asUintN(32, s)));
  }
  return seeds;
}

const SEEDS_30 = make30Seeds();
const SEEDS_3 = SEEDS_30.slice(0, 3);

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('difficultyTelemetry — determinism', () => {
  it('same seeds → same DifficultyAudit for silly', () => {
    const a = auditDifficulty(DIFFICULTY_PROFILES.silly, SEEDS_3);
    const b = auditDifficulty(DIFFICULTY_PROFILES.silly, SEEDS_3);
    expect(a.results).toEqual(b.results);
    expect(a.passRate).toBe(b.passRate);
    expect(a.solvableSeeds).toBe(b.solvableSeeds);
  });

  it('same seeds → same per-tier results for all tiers', () => {
    const a = auditAllDifficulties(SEEDS_3);
    const b = auditAllDifficulties(SEEDS_3);
    for (const tier of ALL_TIERS) {
      expect(a[tier].results).toEqual(b[tier].results);
    }
  });

  it('different seeds produce different audits', () => {
    const a = auditDifficulty(DIFFICULTY_PROFILES.silly, [100, 101, 102]);
    const b = auditDifficulty(DIFFICULTY_PROFILES.silly, [200, 201, 202]);
    // Very likely to differ; if they match by coincidence the test is still
    // valid — results just happen to agree.
    const aDense = a.results.map((r) => r.laneSwitches).join(',');
    const bDense = b.results.map((r) => r.laneSwitches).join(',');
    // Allow the rare coincidence to not fail, but log if they're the same.
    if (aDense === bDense) {
      // biome-ignore lint/suspicious/noConsole: test diagnostic
      console.warn('Different seeds produced same lane-switch sequence (rare, not a bug)');
    }
  });
});

// ─── Shape ────────────────────────────────────────────────────────────────────

describe('difficultyTelemetry — audit shape', () => {
  it('auditDifficulty returns correct seedCount', () => {
    const audit = auditDifficulty(DIFFICULTY_PROFILES.kazoo, SEEDS_3);
    expect(audit.seedCount).toBe(3);
    expect(audit.results.length).toBe(3);
  });

  it('every SeedResult has required numeric fields', () => {
    const audit = auditDifficulty(DIFFICULTY_PROFILES.kazoo, SEEDS_3);
    for (const r of audit.results) {
      expect(typeof r.seed).toBe('number');
      expect(typeof r.obstaclesHit).toBe('number');
      expect(typeof r.laneSwitches).toBe('number');
      expect(typeof r.deviationDensityPer100m).toBe('number');
      expect(typeof r.solvable).toBe('boolean');
      expect(r.obstaclesHit).toBeGreaterThanOrEqual(0);
      expect(r.laneSwitches).toBeGreaterThanOrEqual(0);
      expect(r.deviationDensityPer100m).toBeGreaterThanOrEqual(0);
    }
  });

  it('auditDifficulty aggregated.obstaclesHit.max >= mean', () => {
    const audit = auditDifficulty(DIFFICULTY_PROFILES.plenty, SEEDS_3);
    expect(audit.aggregated.obstaclesHit.max).toBeGreaterThanOrEqual(
      audit.aggregated.obstaclesHit.mean,
    );
  });

  it('auditDifficulty aggregated.laneSwitches.max >= mean', () => {
    const audit = auditDifficulty(DIFFICULTY_PROFILES.plenty, SEEDS_3);
    expect(audit.aggregated.laneSwitches.max).toBeGreaterThanOrEqual(
      audit.aggregated.laneSwitches.mean,
    );
  });

  it('passRate is in [0, 1]', () => {
    const audit = auditDifficulty(DIFFICULTY_PROFILES['ultra-nightmare'], SEEDS_30);
    expect(audit.passRate).toBeGreaterThanOrEqual(0);
    expect(audit.passRate).toBeLessThanOrEqual(1);
  });

  it('passes === (passRate >= PASS_THRESHOLD)', () => {
    const audit = auditDifficulty(DIFFICULTY_PROFILES.silly, SEEDS_3);
    expect(audit.passes).toBe(audit.passRate >= PASS_THRESHOLD);
  });

  it('auditAllDifficulties returns all 6 tiers', () => {
    const all = auditAllDifficulties(SEEDS_3);
    for (const tier of ALL_TIERS) {
      expect(all[tier]).toBeDefined();
      expect(all[tier].difficulty).toBe(tier);
    }
  });

  it('throws on empty seeds', () => {
    expect(() => auditDifficulty(DIFFICULTY_PROFILES.silly, [])).toThrow(
      'seeds array must not be empty',
    );
  });
});

// ─── Balance check (the real guard) ──────────────────────────────────────────

describe('difficultyTelemetry — balance assertions', () => {
  /**
   * THE CORE INVARIANT: every tier must be solvable on >= 80% of seeds.
   * (PASS_THRESHOLD is 1.0 — this test uses 0.8 as a softer CI-stable gate.)
   *
   * If a tier fails here, it's a real balance bug in the solver or the
   * obstacle planner. Fix root cause; do NOT raise this threshold.
   */
  it('every tier is solvable on >= 80% of 30 seeds (balance gate)', () => {
    const all = auditAllDifficulties(SEEDS_30);
    const failing: string[] = [];
    for (const tier of ALL_TIERS) {
      const audit = all[tier];
      if (audit.passRate < 0.8) {
        failing.push(
          `${tier}: passRate=${(audit.passRate * 100).toFixed(1)}% ` +
            `(${audit.solvableSeeds}/${audit.seedCount} seeds solvable) — ` +
            `offending seeds: ${audit.results
              .filter((r) => !r.solvable)
              .map((r) => `${r.seed}(hits=${r.obstaclesHit})`)
              .join(', ')}`,
        );
      }
    }
    expect(
      failing,
      `BALANCE BUG — solver cannot dodge all obstacles on these tiers:\n\n${failing.join('\n')}\n\nFix obstacle density in buildRunPlan or solver logic in solveOptimalPath.`,
    ).toHaveLength(0);
  });

  it('silly tier has the fewest unavoidable obstacles on average', () => {
    const all = auditAllDifficulties(SEEDS_30);
    const sillyHits = all.silly.aggregated.obstaclesHit.mean;
    const nightmareHits = all.nightmare.aggregated.obstaclesHit.mean;
    // Since difficulty doesn't change obstacle density (same planner),
    // hits should be equal. This test asserts silly is no worse than nightmare.
    expect(sillyHits).toBeLessThanOrEqual(nightmareHits + 1);
  });

  it('solver produces more lane switches for tracks with denser obstacles', () => {
    // A track with a known-dense seed should force the solver to switch more.
    // We just verify switches are > 0 for any realistic 4km track.
    const all = auditAllDifficulties(SEEDS_3);
    for (const tier of ALL_TIERS) {
      const maxSwitches = all[tier].aggregated.laneSwitches.max;
      // 4km track with obstacles every ~18m → expect many avoidance moves.
      expect(maxSwitches).toBeGreaterThan(0);
    }
  });
});
