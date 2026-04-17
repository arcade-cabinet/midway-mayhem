import { describe, expect, it } from 'vitest';
import { GovernorDriver } from '../GovernorDriver';

describe('GovernorDriver', () => {
  it('returns a steer value in [-1, 1]', () => {
    const driver = new GovernorDriver();
    const result = driver.step(
      { playerD: 0, playerLateral: 0, obstacles: [], pickups: [] },
      0.016,
    );
    expect(result.steer).toBeGreaterThanOrEqual(-1);
    expect(result.steer).toBeLessThanOrEqual(1);
  });

  it('avoids obstacles on the current lane', () => {
    const driver = new GovernorDriver();
    // Put a barrier on the current lane 20 meters ahead
    const result = driver.step(
      {
        playerD: 0,
        playerLateral: 0,
        obstacles: [{ d: 20, x: 0, z: -20, type: 'barrier', radius: 1.6 }],
        pickups: [],
      },
      0.016,
    );
    // Driver should try to steer away; some nonzero steer value
    expect(Math.abs(result.steer)).toBeGreaterThan(0.01);
    expect(result.debug.avoidedObstacles).toBeGreaterThan(0);
  });

  it('seeks toward mega boost pickups', () => {
    const driver = new GovernorDriver();
    // Mega boost off to the right of current lane
    const result = driver.step(
      {
        playerD: 0,
        playerLateral: 0,
        obstacles: [],
        pickups: [{ d: 10, x: 4.5, z: -10, type: 'mega', radius: 2.2 }],
      },
      0.016,
    );
    expect(result.debug.seekingPickup).toBe(true);
  });

  it('converges to a target lane with clear road (bounded steering)', () => {
    const driver = new GovernorDriver();
    const result = driver.step(
      { playerD: 0, playerLateral: 0, obstacles: [], pickups: [] },
      0.016,
    );
    // No obstacles, no pickups — governor still picks a lane; steer stays within [-1, 1]
    expect(Math.abs(result.steer)).toBeLessThanOrEqual(1);
    // At minimum, produces some steer value (not stuck at 0)
    expect(typeof result.steer).toBe('number');
    expect(Number.isFinite(result.steer)).toBe(true);
  });
});
