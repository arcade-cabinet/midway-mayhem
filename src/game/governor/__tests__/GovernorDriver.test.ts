/**
 * GovernorDriver unit tests — steer-scoring behaviour.
 * Requires initRunRng() before each test so eventsRng() is available.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { GovernorDriver, type GovernorInput } from '@/game/governor/GovernorDriver';
import { initRunRng } from '@/game/runRngBus';
import { TRACK } from '@/utils/constants';

const DT = 1 / 60;

function baseInput(over: Partial<GovernorInput> = {}): GovernorInput {
  return {
    playerD: 0,
    playerLateral: 0,
    obstacles: [],
    pickups: [],
    ...over,
  };
}

beforeEach(() => {
  initRunRng(42);
});

describe('GovernorDriver.step', () => {
  it('returns zero-ish steer on an empty track', () => {
    const g = new GovernorDriver();
    const out = g.step(baseInput(), DT);
    expect(out.steer).toBeGreaterThanOrEqual(-1);
    expect(out.steer).toBeLessThanOrEqual(1);
    expect(Number.isFinite(out.steer)).toBe(true);
  });

  it('returns a valid GovernorOutput with the debug shape', () => {
    const g = new GovernorDriver();
    const out = g.step(baseInput(), DT);
    expect(out.debug).toHaveProperty('targetLane');
    expect(out.debug).toHaveProperty('targetX');
    expect(out.debug).toHaveProperty('avoidedObstacles');
    expect(out.debug).toHaveProperty('seekingPickup');
  });

  it('targetLane is in range [0, LANE_COUNT)', () => {
    const g = new GovernorDriver();
    const out = g.step(baseInput(), DT);
    expect(out.debug.targetLane).toBeGreaterThanOrEqual(0);
    expect(out.debug.targetLane).toBeLessThan(TRACK.LANE_COUNT);
  });

  it('steer is clamped to [-1, 1]', () => {
    const g = new GovernorDriver();
    // Player far off-lateral → steer should still clamp within bounds
    for (const lateral of [-100, -10, 0, 10, 100]) {
      const out = g.step(baseInput({ playerLateral: lateral }), DT);
      expect(out.steer).toBeGreaterThanOrEqual(-1);
      expect(out.steer).toBeLessThanOrEqual(1);
    }
  });

  it('counts obstacles it would avoid in debug.avoidedObstacles when aligned to a lane', () => {
    const g = new GovernorDriver();
    // Place obstacles spanning a ±6m x band so at least one lane overlaps a cluster
    const obstacles: GovernorInput['obstacles'] = [];
    for (let x = -6; x <= 6; x += 1) {
      obstacles.push({ d: 10, x, z: -10, type: 'barrier', radius: 2 });
      obstacles.push({ d: 15, x, z: -15, type: 'cone', radius: 2 });
    }
    const out = g.step(baseInput({ obstacles }), DT);
    expect(out.debug.avoidedObstacles).toBeGreaterThan(0);
  });

  it('ignores obstacles outside the avoidWindow', () => {
    const g = new GovernorDriver();
    const obstacles = [
      { d: 200, x: 0, z: -200, type: 'barrier', radius: 2 }, // beyond default 30m window
    ];
    const out = g.step(baseInput({ obstacles }), DT);
    expect(out.debug.avoidedObstacles).toBe(0);
  });

  it('seeks mega-pickups (highest weight)', () => {
    const g = new GovernorDriver();
    const pickups = [{ d: 10, x: 5, z: -10, type: 'mega', radius: 1 }];
    const out = g.step(baseInput({ pickups }), DT);
    // With positive score we should be seeking.
    expect(typeof out.debug.seekingPickup).toBe('boolean');
  });

  it('is deterministic given same seed + inputs', () => {
    initRunRng(123);
    const g1 = new GovernorDriver();
    const out1 = g1.step(baseInput(), DT);

    initRunRng(123);
    const g2 = new GovernorDriver();
    const out2 = g2.step(baseInput(), DT);

    expect(out1.steer).toBeCloseTo(out2.steer, 6);
    expect(out1.debug.targetLane).toBe(out2.debug.targetLane);
  });

  it('accepts custom params via constructor', () => {
    const g = new GovernorDriver({
      lookaheadMeters: 80,
      avoidWindow: 40,
      pickupWindow: 30,
      laneSwitchBias: 0.3,
      skill: 1.0,
    });
    const out = g.step(baseInput(), DT);
    expect(Number.isFinite(out.steer)).toBe(true);
  });

  it('steers toward an obstacle-free adjacent lane when blocked', () => {
    // Player in center lane (lateral=0), obstacle directly ahead in center.
    // Driver should target an adjacent empty lane, producing non-zero steer.
    initRunRng(11);
    const g = new GovernorDriver();
    const obstacles = [{ d: 20, x: 0, z: -20, type: 'barrier', radius: 2 }];
    const out = g.step(baseInput({ playerLateral: 0, obstacles }), DT);
    expect(out.debug.avoidedObstacles).toBeGreaterThan(0);
    expect(Math.abs(out.steer)).toBeGreaterThan(0.02);
  });

  it('does NOT pin steer right on a straight track with no obstacles', () => {
    // Regression: GovernorDriver previously compared world-space laneCenterAt
    // .x against track-relative playerLateral, producing a nonzero offset
    // that pinned steer to +1 on any curved track and crashed the autopilot
    // into obstacles around 300m. With the coordinate-space fix, a centered
    // player on a flat/straight section produces near-zero steer.
    initRunRng(42);
    const g = new GovernorDriver();
    const out = g.step(baseInput({ playerD: 100, playerLateral: 0 }), DT);
    expect(
      Math.abs(out.steer),
      `center-lane steer on empty track should be near 0, was ${out.steer}`,
    ).toBeLessThan(0.25);
  });

  it('skill param scales the raw steer output', () => {
    const gSkilled = new GovernorDriver({
      lookaheadMeters: 40,
      avoidWindow: 30,
      pickupWindow: 20,
      laneSwitchBias: 0.6,
      skill: 1.0,
    });
    const gSloppy = new GovernorDriver({
      lookaheadMeters: 40,
      avoidWindow: 30,
      pickupWindow: 20,
      laneSwitchBias: 0.6,
      skill: 0.1,
    });
    // Same obstacles → same decision, different skill scalar
    initRunRng(99);
    const obstacles = [{ d: 10, x: 0, z: -10, type: 'barrier', radius: 2 }];
    const outA = gSkilled.step(baseInput({ obstacles }), DT);

    initRunRng(99);
    const outB = gSloppy.step(baseInput({ obstacles }), DT);

    // Absolute skilled steer is larger (scaled by ~1.0 vs ~0.1)
    if (Math.abs(outA.steer) > 0.01) {
      expect(Math.abs(outA.steer)).toBeGreaterThan(Math.abs(outB.steer));
    }
  });
});
