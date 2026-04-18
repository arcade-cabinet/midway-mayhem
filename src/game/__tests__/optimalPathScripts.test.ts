/**
 * optimalPathScripts unit tests — distance-triggered keyboard scripts for
 * the e2e governor. Covers all four PathOutcome branches via hand-crafted
 * RunPlans plus the scriptForSeed convenience wrapper.
 */
import { describe, expect, it } from 'vitest';
import { scriptForOutcome, scriptForSeed } from '@/game/optimalPathScripts';
import type { RunPlan } from '@/game/runPlan';

function plan(overrides: Partial<RunPlan> = {}): RunPlan {
  return {
    seed: 1,
    distance: 2000,
    obstacles: [],
    pickups: [],
    ...overrides,
  } as RunPlan;
}

describe('scriptForOutcome: finish-clean', () => {
  it('returns [] when plan has no obstacles or pickups (solver stays in centre)', () => {
    const script = scriptForOutcome(plan(), 'finish-clean');
    expect(script).toEqual([]);
  });

  it('emits paired keydown/keyup events when the solver has to switch lanes', () => {
    const p = plan({
      obstacles: [
        { d: 200, lane: 2, kind: 'barrier', width: 1 },
        { d: 600, lane: 1, kind: 'cones', width: 1 },
      ] as unknown as RunPlan['obstacles'],
    });
    const script = scriptForOutcome(p, 'finish-clean');
    expect(script.length).toBeGreaterThan(0);
    // Every keydown must be paired with a later keyup on the same key.
    const keydowns = script.filter((e) => e.type === 'keydown');
    const keyups = script.filter((e) => e.type === 'keyup');
    expect(keydowns.length).toBe(keyups.length);
    for (const k of keydowns) {
      const matchedUp = keyups.find((u) => u.key === k.key && u.dTrigger > k.dTrigger);
      expect(matchedUp).toBeDefined();
    }
  });

  it('only emits Arrow keys', () => {
    const p = plan({
      obstacles: [
        { d: 200, lane: 0, kind: 'barrier', width: 1 },
        { d: 500, lane: 3, kind: 'cones', width: 1 },
      ] as unknown as RunPlan['obstacles'],
    });
    const script = scriptForOutcome(p, 'finish-clean');
    for (const e of script) {
      expect(['ArrowLeft', 'ArrowRight']).toContain(e.key);
    }
  });
});

describe('scriptForOutcome: collide-first', () => {
  it('returns [] when plan has no obstacles', () => {
    expect(scriptForOutcome(plan(), 'collide-first')).toEqual([]);
  });

  it('when first obstacle is in start lane (lane 2), nudges and releases to hold centre', () => {
    // LANE_COUNT=4 → startLane = floor(4/2) = 2
    const p = plan({
      obstacles: [
        { d: 100, lane: 2, kind: 'barrier', width: 1 },
      ] as unknown as RunPlan['obstacles'],
    });
    const script = scriptForOutcome(p, 'collide-first');
    expect(script).toHaveLength(2);
    expect(script[0]?.type).toBe('keydown');
    expect(script[1]?.type).toBe('keyup');
    expect(script[0]?.dTrigger).toBe(script[1]?.dTrigger);
  });

  it('steers toward first obstacle lane when it is to the left of start', () => {
    const p = plan({
      obstacles: [
        { d: 300, lane: 0, kind: 'barrier', width: 1 },
      ] as unknown as RunPlan['obstacles'],
    });
    const script = scriptForOutcome(p, 'collide-first');
    expect(script[0]?.key).toBe('ArrowLeft');
    expect(script[0]?.type).toBe('keydown');
    expect(script[1]?.key).toBe('ArrowLeft');
    expect(script[1]?.type).toBe('keyup');
    // keyup is held 12 * |delta| metres after keydown; delta = 0-2 = -2 → 24m
    const delta = Math.abs(0 - 2);
    const expectedHold = delta * 12;
    expect((script[1]?.dTrigger ?? 0) - (script[0]?.dTrigger ?? 0)).toBe(expectedHold);
  });

  it('steers right when first obstacle is to the right of start', () => {
    const p = plan({
      obstacles: [
        { d: 300, lane: 3, kind: 'barrier', width: 1 },
      ] as unknown as RunPlan['obstacles'],
    });
    const script = scriptForOutcome(p, 'collide-first');
    expect(script[0]?.key).toBe('ArrowRight');
  });

  it('clamps dTrigger at 0 when first obstacle is within 30m of start', () => {
    const p = plan({
      obstacles: [{ d: 10, lane: 0, kind: 'barrier', width: 1 }] as unknown as RunPlan['obstacles'],
    });
    const script = scriptForOutcome(p, 'collide-first');
    expect(script[0]?.dTrigger).toBe(0);
  });
});

describe('scriptForOutcome: plunge-off-ramp', () => {
  it('emits a single ArrowRight keydown/keyup pair', () => {
    const script = scriptForOutcome(plan(), 'plunge-off-ramp');
    expect(script).toHaveLength(2);
    expect(script[0]?.key).toBe('ArrowRight');
    expect(script[0]?.type).toBe('keydown');
    expect(script[1]?.key).toBe('ArrowRight');
    expect(script[1]?.type).toBe('keyup');
  });

  it('keyup is always after keydown', () => {
    const script = scriptForOutcome(plan(), 'plunge-off-ramp');
    expect(script[1]?.dTrigger ?? 0).toBeGreaterThan(script[0]?.dTrigger ?? 0);
  });

  it('does not depend on plan contents (ramp comes from track composition)', () => {
    const emptyPlan = plan();
    const loadedPlan = plan({
      obstacles: [{ d: 50, lane: 1, kind: 'barrier', width: 1 }] as unknown as RunPlan['obstacles'],
    });
    const a = scriptForOutcome(emptyPlan, 'plunge-off-ramp');
    const b = scriptForOutcome(loadedPlan, 'plunge-off-ramp');
    expect(a).toEqual(b);
  });
});

describe('scriptForOutcome: survive-30s', () => {
  it('filters finish-clean script to events with dTrigger < 900 (30s * 30m/s)', () => {
    const p = plan({
      obstacles: [
        { d: 200, lane: 0, kind: 'barrier', width: 1 },
        { d: 500, lane: 3, kind: 'cones', width: 1 },
        { d: 1500, lane: 0, kind: 'barrier', width: 1 },
      ] as unknown as RunPlan['obstacles'],
    });
    const full = scriptForOutcome(p, 'finish-clean');
    const survive = scriptForOutcome(p, 'survive-30s');
    for (const e of survive) {
      expect(e.dTrigger).toBeLessThan(900);
    }
    expect(survive.length).toBeLessThanOrEqual(full.length);
  });
});

describe('scriptForSeed', () => {
  it('is deterministic — same seed+outcome → identical script', () => {
    const a = scriptForSeed(42, 'finish-clean');
    const b = scriptForSeed(42, 'finish-clean');
    expect(a).toEqual(b);
  });

  it('different outcomes on same seed can differ', () => {
    const clean = scriptForSeed(42, 'finish-clean');
    const plunge = scriptForSeed(42, 'plunge-off-ramp');
    // They may share structure, but plunge always has exactly 2 events.
    expect(plunge).toHaveLength(2);
    // finish-clean length depends on solver; they should not be interchangeable structurally
    expect(plunge[0]?.key).toBe('ArrowRight');
    void clean;
  });

  it('produces only Arrow keys regardless of seed', () => {
    for (const seed of [1, 2, 99, 12345]) {
      const script = scriptForSeed(seed, 'finish-clean');
      for (const e of script) {
        expect(['ArrowLeft', 'ArrowRight']).toContain(e.key);
      }
    }
  });
});
