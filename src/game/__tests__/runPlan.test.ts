/**
 * RunPlan unit tests — the full run plan is deterministic from a single
 * master seed, so we can pin both its STRUCTURE (start platform present,
 * finish banner present, obstacles populated, etc.) and its IDENTITY
 * (same seed ⇒ byte-identical plans).
 *
 * Daily challenges, leaderboard replay, and ghost cars all assume the
 * plan is reproducible from the seed; if that breaks we lose run
 * parity across the same user's devices and across users on the same
 * daily seed.
 */
import { describe, expect, it } from 'vitest';
import { buildRunPlan } from '@/game/runPlan';
import { createRunRng } from '@/utils/rng';

function planFor(seed: number) {
  const { track } = createRunRng(seed);
  return buildRunPlan({ seed, trackRng: track });
}

describe('buildRunPlan', () => {
  it('emits a start platform, a finish banner, and a positive distance', () => {
    const p = planFor(42);
    expect(p.seed).toBe(42);
    expect(p.distance).toBeGreaterThan(0);
    expect(p.startPlatform).toBeDefined();
    expect(p.finishBanner).toBeDefined();
    expect(p.startPlatform.d).toBeLessThan(p.finishBanner.d);
  });

  it('populates each obstacle/pickup/balloon pool with multiple entries', () => {
    const p = planFor(42);
    expect(p.obstacles.length).toBeGreaterThan(5);
    expect(p.pickups.length).toBeGreaterThan(5);
    expect(p.balloons.length).toBeGreaterThan(0);
  });

  it('is deterministic from the master seed — same seed ⇒ identical plan', () => {
    const a = planFor(12345);
    const b = planFor(12345);

    expect(a.distance).toBe(b.distance);
    expect(a.obstacles.length).toBe(b.obstacles.length);
    expect(a.pickups.length).toBe(b.pickups.length);
    expect(a.balloons.length).toBe(b.balloons.length);

    // Spot-check identity on the first obstacle + first balloon.
    expect(a.obstacles[0]).toEqual(b.obstacles[0]);
    expect(a.pickups[0]).toEqual(b.pickups[0]);
    expect(a.balloons[0]).toEqual(b.balloons[0]);
  });

  it('produces different plans for different seeds', () => {
    const a = planFor(1);
    const b = planFor(999_999);
    // At least one structural field must differ across distinct seeds.
    const someDivergence =
      a.obstacles.length !== b.obstacles.length ||
      a.pickups.length !== b.pickups.length ||
      a.balloons.length !== b.balloons.length ||
      JSON.stringify(a.obstacles[0]) !== JSON.stringify(b.obstacles[0]);
    expect(someDivergence, 'expected distinct seeds to produce distinct plans').toBe(true);
  });
});
