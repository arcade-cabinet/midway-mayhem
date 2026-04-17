import { describe, expect, it } from 'vitest';
import { laneCenterAt } from '@/track/trackGenerator';
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
    // Obstacle at d=20 placed at lane-1 spline x (lane index 1 = right lane).
    // GovernorDriver lookaheadMeters=40 means it scores lanes at playerD+40.
    const obstacleD = 20;
    const obstacleX = laneCenterAt(obstacleD, 1).x;
    const result = driver.step(
      {
        playerD: 0,
        playerLateral: 0,
        obstacles: [{ d: obstacleD, x: obstacleX, z: -obstacleD, type: 'barrier', radius: 1.6 }],
        pickups: [],
      },
      0.016,
    );
    expect(result.debug.avoidedObstacles).toBeGreaterThan(0);
  });

  it('seeks toward mega boost pickups on a lane', () => {
    const driver = new GovernorDriver();
    // Mega boost within pickupWindow=20m, at lane-1 spline x at d=15.
    const pickupD = 15;
    const pickupX = laneCenterAt(pickupD, 1).x;
    const result = driver.step(
      {
        playerD: 0,
        playerLateral: 0,
        obstacles: [],
        pickups: [{ d: pickupD, x: pickupX, z: -pickupD, type: 'mega', radius: 2.2 }],
      },
      0.016,
    );
    expect(result.debug.seekingPickup).toBe(true);
  });

  it('produces a finite, bounded steer value with clear road (no obstacles or pickups)', () => {
    const driver = new GovernorDriver();
    const result = driver.step({ playerD: 0, playerLateral: 0, obstacles: [], pickups: [] }, 0.016);
    // No obstacles, no pickups — governor still picks a lane; steer stays within [-1, 1]
    expect(Math.abs(result.steer)).toBeLessThanOrEqual(1);
    expect(typeof result.steer).toBe('number');
    expect(Number.isFinite(result.steer)).toBe(true);
  });
});
