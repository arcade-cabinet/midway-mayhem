import { describe, expect, it } from 'vitest';
import { buildRunPlan, RUN_PLAN_DISTANCE_M } from '@/game/runPlan';
import { createRunRng } from '@/utils/rng';

function planFromSeed(seed: number) {
  const rng = createRunRng(seed);
  return buildRunPlan({ seed, trackRng: rng.track });
}

describe('runPlan — pre-baked deterministic track', () => {
  it('same seed produces identical plan', () => {
    const a = planFromSeed(12345);
    const b = planFromSeed(12345);
    expect(a.obstacles).toEqual(b.obstacles);
    expect(a.pickups).toEqual(b.pickups);
    expect(a.balloons).toEqual(b.balloons);
    expect(a.mirrorRooms).toEqual(b.mirrorRooms);
    expect(a.fireHoops).toEqual(b.fireHoops);
  });

  it('different seeds produce different plans', () => {
    const a = planFromSeed(1);
    const b = planFromSeed(2);
    expect(a.obstacles).not.toEqual(b.obstacles);
  });

  it('bakes start platform at d=0 and finish banner at distance', () => {
    const plan = planFromSeed(42);
    expect(plan.startPlatform.d).toBe(0);
    expect(plan.finishBanner.d).toBe(plan.distance);
    expect(plan.distance).toBe(RUN_PLAN_DISTANCE_M);
  });

  it('spawns are monotonically increasing in d', () => {
    const plan = planFromSeed(99);
    for (const arr of [
      plan.obstacles,
      plan.pickups,
      plan.balloons,
      plan.mirrorRooms,
      plan.fireHoops,
    ]) {
      for (let i = 1; i < arr.length; i++) {
        expect((arr[i] as { d: number }).d).toBeGreaterThanOrEqual((arr[i - 1] as { d: number }).d);
      }
    }
  });

  it('critter obstacles carry a critter kind + idle phase', () => {
    const plan = planFromSeed(7);
    const critters = plan.obstacles.filter((o) => o.type === 'critter');
    expect(critters.length).toBeGreaterThan(0);
    for (const c of critters) {
      expect(c.critter).toBeDefined();
      expect(typeof c.idlePhase).toBe('number');
      expect(c.idlePhase).toBeGreaterThanOrEqual(0);
      expect(c.idlePhase).toBeLessThanOrEqual(Math.PI * 2);
    }
  });

  it('every spawn lane is within [0, LANE_COUNT)', () => {
    const plan = planFromSeed(555);
    for (const o of plan.obstacles) {
      expect(o.lane).toBeGreaterThanOrEqual(0);
      expect(o.lane).toBeLessThan(3);
    }
    for (const p of plan.pickups) {
      expect(p.lane).toBeGreaterThanOrEqual(0);
      expect(p.lane).toBeLessThan(3);
    }
  });

  it('pickup type distribution favors tickets > boost > mega', () => {
    const plan = planFromSeed(1234);
    const counts = { ticket: 0, boost: 0, mega: 0 };
    for (const p of plan.pickups) counts[p.type]++;
    expect(counts.ticket).toBeGreaterThan(counts.boost);
    expect(counts.boost).toBeGreaterThan(counts.mega);
  });

  it('plan for a 4km run completes in <50ms', () => {
    const t0 = performance.now();
    planFromSeed(Date.now() & 0xffffffff);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(50);
  });
});
