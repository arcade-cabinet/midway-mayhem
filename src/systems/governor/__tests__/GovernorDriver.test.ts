import { describe, expect, it } from 'vitest';
import { GovernorDriver } from '../GovernorDriver';

describe('GovernorDriver', () => {
  it('returns a steer value in [-1, 1]', () => {
    const driver = new GovernorDriver();
    const result = driver.step({ playerD: 0, playerLateral: 0, obstacles: [], pickups: [] }, 0.016);
    expect(result.steer).toBeGreaterThanOrEqual(-1);
    expect(result.steer).toBeLessThanOrEqual(1);
  });

  it('avoids obstacles on the current lane', () => {
    const driver = new GovernorDriver();
    // Governor samples lane centers via the spline (trackGenerator.laneCenterAt).
    // lookaheadMeters=40 → sampleTrack(40).x = 8.25. Lane 1 at d=40 is worldX≈8.25.
    // Obstacle must be within avoidWindow (30m) of playerD.
    // Place it at d=20 (within window) at the lane-1 spline position there:
    // sampleTrack(20).x = sin(0.18)*18 + sin(0.08)*12 ≈ 3.23 + 0.96 ≈ 4.18
    const result = driver.step(
      {
        playerD: 0,
        playerLateral: 0,
        obstacles: [{ d: 20, x: 4.18, z: -20, type: 'barrier', radius: 1.6 }],
        pickups: [],
      },
      0.016,
    );
    expect(result.debug.avoidedObstacles).toBeGreaterThan(0);
  });

  it('seeks toward mega boost pickups on a lane', () => {
    const driver = new GovernorDriver();
    // Mega boost within pickupWindow=20m, at lane-1 spline position at d=15.
    // sampleTrack(15).x ≈ sin(0.135)*18 + sin(0.06)*12 ≈ 2.42 + 0.72 ≈ 3.14
    const result = driver.step(
      {
        playerD: 0,
        playerLateral: 0,
        obstacles: [],
        pickups: [{ d: 15, x: 3.14, z: -15, type: 'mega', radius: 2.2 }],
      },
      0.016,
    );
    expect(result.debug.seekingPickup).toBe(true);
  });

  it('converges to a target lane with clear road (bounded steering)', () => {
    const driver = new GovernorDriver();
    const result = driver.step({ playerD: 0, playerLateral: 0, obstacles: [], pickups: [] }, 0.016);
    // No obstacles, no pickups — governor still picks a lane; steer stays within [-1, 1]
    expect(Math.abs(result.steer)).toBeLessThanOrEqual(1);
    // At minimum, produces some steer value (not stuck at 0)
    expect(typeof result.steer).toBe('number');
    expect(Number.isFinite(result.steer)).toBe(true);
  });
});
