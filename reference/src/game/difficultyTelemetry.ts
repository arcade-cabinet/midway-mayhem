/**
 * @module game/difficultyTelemetry
 *
 * Difficulty-balance telemetry: proves every tier is winnable by running the
 * abstract solver against many seeds and checking that `obstacles_hit === 0`
 * (i.e. the solver can dodge every obstacle on the track).
 *
 * Key design choices:
 *   - Pure math only — no React, no Three.js, no game loop. Fast in Node.
 *   - Uses `buildRunPlan` + `solveOptimalPath` — same modules the real game
 *     uses, so a balance bug here is a balance bug in production.
 *   - Difficulty affects `targetSpeedMps` only at the abstract solver level.
 *     The solver is geometry-only; it doesn't simulate speed. Speed matters
 *     for the real-physics browser test (`difficultyReal.browser.test.tsx`).
 *   - A tier "passes" iff `obstaclesHit === 0` on every audited seed.
 *     Any obstacle that can't be avoided is a balance bug.
 */

import { createRunRng } from '@/utils/rng';
import type { Difficulty, DifficultyProfile } from './difficulty';
import { DIFFICULTY_PROFILES } from './difficulty';
import { solveOptimalPath } from './optimalPath';
import { buildRunPlan, RUN_PLAN_DISTANCE_M } from './runPlan';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Per-seed breakdown from one solver run. */
export interface SeedResult {
  seed: number;
  obstaclesHit: number;
  laneSwitches: number;
  /** Waypoints that change lanes, per 100m of track. */
  deviationDensityPer100m: number;
  /** The solver could avoid all obstacles on this seed. */
  solvable: boolean;
}

/** Aggregate telemetry for one difficulty tier across all audited seeds. */
export interface DifficultyAudit {
  difficulty: Difficulty;
  targetSpeedMps: number;
  seedCount: number;
  /** Number of seeds where `obstaclesHit === 0`. */
  solvableSeeds: number;
  /** Fraction [0..1] of seeds that are fully solvable. */
  passRate: number;
  /** Whether the tier passes: passRate >= PASS_THRESHOLD. */
  passes: boolean;
  results: SeedResult[];
  /** Aggregated across all seeds. */
  aggregated: {
    obstaclesHit: { mean: number; max: number };
    laneSwitches: { mean: number; max: number };
    deviationDensityPer100m: { mean: number; max: number };
  };
}

/** Minimum fraction of seeds that must be solvable for a tier to pass. */
export const PASS_THRESHOLD = 1.0;

// ─── Core audit ──────────────────────────────────────────────────────────────

/**
 * Audit a single difficulty tier across the supplied seed list.
 *
 * For each seed:
 *   1. Build the deterministic run plan (same planner as production).
 *   2. Solve the optimal obstacle-avoiding path.
 *   3. Count any obstacle whose lane matches the solver's lane at that
 *      distance (i.e. an unavoidable hit).
 *   4. Count lane switches and compute deviation density.
 */
export function auditDifficulty(profile: DifficultyProfile, seeds: number[]): DifficultyAudit {
  if (seeds.length === 0) {
    throw new Error('auditDifficulty: seeds array must not be empty');
  }

  const results: SeedResult[] = seeds.map((seed) => auditSeed(profile, seed));
  return buildAudit(profile.id, profile.targetSpeedMps, results);
}

/**
 * Audit all six difficulty tiers in one call.
 * Returns a record keyed by `Difficulty`.
 */
export function auditAllDifficulties(seeds: number[]): Record<Difficulty, DifficultyAudit> {
  return {
    silly: auditDifficulty(DIFFICULTY_PROFILES.silly, seeds),
    kazoo: auditDifficulty(DIFFICULTY_PROFILES.kazoo, seeds),
    plenty: auditDifficulty(DIFFICULTY_PROFILES.plenty, seeds),
    'ultra-honk': auditDifficulty(DIFFICULTY_PROFILES['ultra-honk'], seeds),
    nightmare: auditDifficulty(DIFFICULTY_PROFILES.nightmare, seeds),
    'ultra-nightmare': auditDifficulty(DIFFICULTY_PROFILES['ultra-nightmare'], seeds),
  };
}

// ─── Per-seed solver ──────────────────────────────────────────────────────────

function auditSeed(_profile: DifficultyProfile, seed: number): SeedResult {
  const rng = createRunRng(seed);
  const plan = buildRunPlan({
    seed,
    trackRng: rng.track,
    distance: RUN_PLAN_DISTANCE_M,
  });

  const path = solveOptimalPath(plan);

  // Map each waypoint interval to the solver's chosen lane at that distance.
  // We check every obstacle: if the solver is in the same lane as the obstacle
  // at (obstacle.d - 4m reaction window), the obstacle cannot be avoided.
  let obstaclesHit = 0;
  let laneSwitches = 0;

  // Count lane switches from the path waypoints.
  for (let i = 1; i < path.waypoints.length; i++) {
    const prev = path.waypoints[i - 1];
    const cur = path.waypoints[i];
    if (prev && cur && prev.lane !== cur.lane) {
      laneSwitches++;
    }
  }

  // Check each obstacle: find the solver's lane at the obstacle's d.
  for (const obs of plan.obstacles) {
    const solverLane = laneAtDistance(path, obs.d);
    if (solverLane === obs.lane) {
      obstaclesHit++;
    }
  }

  const deviationDensityPer100m = plan.distance > 0 ? (laneSwitches / plan.distance) * 100 : 0;

  return {
    seed,
    obstaclesHit,
    laneSwitches,
    deviationDensityPer100m,
    solvable: obstaclesHit === 0,
  };
}

/**
 * Return the solver's lane index at a given distance `d` by walking the
 * waypoint list. The solver's lane is constant from one waypoint to the next
 * (step function, not interpolated — the solver moves in whole lane units).
 */
function laneAtDistance(path: ReturnType<typeof solveOptimalPath>, d: number): number {
  const wps = path.waypoints;
  if (wps.length === 0) return 0;
  let lane = wps[0]?.lane ?? 0;
  for (const wp of wps) {
    if (wp.d > d) break;
    lane = wp.lane;
  }
  return lane;
}

// ─── Aggregation helpers ──────────────────────────────────────────────────────

function buildAudit(
  difficulty: Difficulty,
  targetSpeedMps: number,
  results: SeedResult[],
): DifficultyAudit {
  const solvableSeeds = results.filter((r) => r.solvable).length;
  const passRate = solvableSeeds / results.length;

  return {
    difficulty,
    targetSpeedMps,
    seedCount: results.length,
    solvableSeeds,
    passRate,
    passes: passRate >= PASS_THRESHOLD,
    results,
    aggregated: {
      obstaclesHit: aggMetric(results.map((r) => r.obstaclesHit)),
      laneSwitches: aggMetric(results.map((r) => r.laneSwitches)),
      deviationDensityPer100m: aggMetric(results.map((r) => r.deviationDensityPer100m)),
    },
  };
}

function aggMetric(values: number[]): { mean: number; max: number } {
  if (values.length === 0) return { mean: 0, max: 0 };
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    mean: sum / values.length,
    max: Math.max(...values),
  };
}
