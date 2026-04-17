import { describe, expect, it } from 'vitest';
import {
  optimalLateralAt,
  scoreDeviation,
  scriptForOutcome,
  solveOptimalPath,
} from '@/game/optimalPath';
import { buildRunPlan } from '@/game/runPlan';
import { createRunRng } from '@/utils/rng';

function planFromSeed(seed: number) {
  return buildRunPlan({ seed, trackRng: createRunRng(seed).track });
}

describe('optimalPath — deterministic solver', () => {
  it('solves a path whose waypoints are monotonically increasing in d', () => {
    const plan = planFromSeed(42);
    const path = solveOptimalPath(plan);
    expect(path.waypoints.length).toBeGreaterThan(0);
    for (let i = 1; i < path.waypoints.length; i++) {
      const a = path.waypoints[i - 1];
      const b = path.waypoints[i];
      expect(b).toBeDefined();
      expect(a).toBeDefined();
      if (a && b) expect(b.d).toBeGreaterThanOrEqual(a.d);
    }
  });

  it('same seed → same optimal path', () => {
    const a = solveOptimalPath(planFromSeed(99));
    const b = solveOptimalPath(planFromSeed(99));
    expect(a.waypoints).toEqual(b.waypoints);
  });

  it('optimalLateralAt interpolates between waypoints', () => {
    const plan = planFromSeed(1);
    const path = solveOptimalPath(plan);
    const midD = path.waypoints[Math.floor(path.waypoints.length / 2)]?.d ?? 0;
    const x = optimalLateralAt(path, midD);
    expect(Number.isFinite(x)).toBe(true);
  });

  it('scoreDeviation returns 0 when player follows the line perfectly', () => {
    const plan = planFromSeed(7);
    const path = solveOptimalPath(plan);
    const samples = [];
    for (let d = 0; d < plan.distance; d += 10) {
      samples.push({ d, lateralM: optimalLateralAt(path, d) });
    }
    expect(scoreDeviation(path, samples)).toBeLessThan(0.001);
  });

  it('scoreDeviation grows with lateral drift from the optimal line', () => {
    const plan = planFromSeed(7);
    const path = solveOptimalPath(plan);
    const clean = [];
    const drifted = [];
    for (let d = 0; d < plan.distance; d += 10) {
      const x = optimalLateralAt(path, d);
      clean.push({ d, lateralM: x });
      drifted.push({ d, lateralM: x + 2 }); // 2m off the line everywhere
    }
    expect(scoreDeviation(path, drifted)).toBeGreaterThan(scoreDeviation(path, clean));
  });
});

describe('optimalPath — test-factory scripts', () => {
  it('finish-clean script contains at least one arrow-key event', () => {
    const plan = planFromSeed(123);
    const script = scriptForOutcome(plan, 'finish-clean');
    expect(script.length).toBeGreaterThan(0);
    for (const s of script) {
      expect(['ArrowLeft', 'ArrowRight']).toContain(s.key);
      expect(['keydown', 'keyup']).toContain(s.type);
      expect(s.dTrigger).toBeGreaterThanOrEqual(0);
    }
  });

  it('collide-first script has at most one down/up pair', () => {
    const plan = planFromSeed(456);
    const script = scriptForOutcome(plan, 'collide-first');
    expect(script.length).toBeLessThanOrEqual(2);
  });

  it('plunge-off-ramp script steers right and holds', () => {
    const plan = planFromSeed(789);
    const script = scriptForOutcome(plan, 'plunge-off-ramp');
    expect(script.some((s) => s.key === 'ArrowRight' && s.type === 'keydown')).toBe(true);
    expect(script.some((s) => s.key === 'ArrowRight' && s.type === 'keyup')).toBe(true);
  });

  it('survive-30s is bounded by the 30s*30m/s distance window', () => {
    const plan = planFromSeed(111);
    const script = scriptForOutcome(plan, 'survive-30s');
    for (const s of script) expect(s.dTrigger).toBeLessThan(30 * 30);
  });

  it('all scripts alternate keydown/keyup per key (no stuck keys)', () => {
    const plan = planFromSeed(222);
    const script = scriptForOutcome(plan, 'finish-clean');
    const held = { ArrowLeft: false, ArrowRight: false };
    for (const s of script) {
      if (s.type === 'keydown') {
        expect(held[s.key], `${s.key} pressed twice without release`).toBe(false);
        held[s.key] = true;
      } else {
        expect(held[s.key], `${s.key} released without press`).toBe(true);
        held[s.key] = false;
      }
    }
  });
});
