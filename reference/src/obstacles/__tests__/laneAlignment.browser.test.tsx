/**
 * laneAlignment.browser.test.tsx
 *
 * Verifies that ObstacleSpawner.spawnAtExact() places obstacles at the correct
 * lateral position for each lane.
 *
 * For each lane 0, 1, 2 at distance d=100:
 *   - Spawn one obstacle via spawnAtExact(d, lane, type)
 *   - Read obstacle.x, obstacle.z
 *   - Assert matches laneCenterAt(d, lane) within 0.1m
 *   - Assert lateral separation between adjacent lanes > 0 (lanes are distinct)
 *
 * Note: laneCenterAt returns world-space position on the curved track;
 * laneCenterX returns only the flat lateral offset, which is NOT the same
 * as the world-space x on a curved spline.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { ObstacleSpawner } from '@/obstacles/obstacleSpawner';
import { laneCenterAt } from '@/track/trackGenerator';
import type { ObstacleType } from '@/utils/constants';
import { createRng } from '@/utils/rng';

const OBSTACLE_TYPES_TO_TEST: ObstacleType[] = ['barrier', 'cones', 'gate'];
const TEST_DISTANCE = 100;
const LANE_COUNT = 3; // default from tunables
const POSITION_TOLERANCE = 0.1;

describe('ObstacleSpawner lane alignment (spawnAtExact)', () => {
  let spawner: ObstacleSpawner;

  beforeEach(() => {
    spawner = new ObstacleSpawner(createRng(42));
    spawner.reset(0);
  });

  for (const type of OBSTACLE_TYPES_TO_TEST) {
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      it(`type=${type} lane=${lane}: obstacle.x ≈ laneCenterAt(${TEST_DISTANCE}, ${lane}).x`, () => {
        spawner.spawnAtExact(TEST_DISTANCE, lane, type);

        const obstacles = spawner.getObstacles();
        expect(obstacles.length).toBe(1);

        const obs = obstacles[0]!;
        expect(obs.lane).toBe(lane);
        expect(obs.d).toBe(TEST_DISTANCE);
        expect(obs.type).toBe(type);

        // laneCenterAt returns world-space position on the curved track
        const expected = laneCenterAt(TEST_DISTANCE, lane);
        expect(Math.abs(obs.x - expected.x)).toBeLessThan(POSITION_TOLERANCE);
        expect(Math.abs(obs.z - expected.z)).toBeLessThan(POSITION_TOLERANCE);
      });
    }
  }

  it('multiple spawnAtExact calls: each obstacle at its own lane center', () => {
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      spawner.spawnAtExact(TEST_DISTANCE + lane * 10, lane, 'barrier');
    }

    const obstacles = spawner.getObstacles();
    expect(obstacles.length).toBe(LANE_COUNT);

    for (let i = 0; i < LANE_COUNT; i++) {
      const obs = obstacles[i]!;
      const expected = laneCenterAt(obs.d, obs.lane);
      expect(Math.abs(obs.x - expected.x)).toBeLessThan(POSITION_TOLERANCE);
      expect(Math.abs(obs.z - expected.z)).toBeLessThan(POSITION_TOLERANCE);
    }
  });

  it('adjacent lanes at same d are laterally separated (distinct positions)', () => {
    // Lane positions should differ by at least LANE_WIDTH * 0.5 in world space
    for (let lane = 0; lane < LANE_COUNT - 1; lane++) {
      const posA = laneCenterAt(TEST_DISTANCE, lane);
      const posB = laneCenterAt(TEST_DISTANCE, lane + 1);
      const lateralDist = Math.sqrt((posA.x - posB.x) ** 2 + (posA.z - posB.z) ** 2);
      // Lanes must be more than 1m apart (LANE_WIDTH default = ~3.5m)
      expect(lateralDist).toBeGreaterThan(1.0);
    }
  });

  it('critter type: correct radius and world-space position', () => {
    spawner.spawnAtExact(TEST_DISTANCE, 1, 'critter');
    const obs = spawner.getObstacles()[0]!;
    expect(obs.critter).toBe('cow');
    expect(obs.radius).toBe(1.8);
    const expected = laneCenterAt(TEST_DISTANCE, 1);
    expect(Math.abs(obs.x - expected.x)).toBeLessThan(POSITION_TOLERANCE);
    expect(Math.abs(obs.z - expected.z)).toBeLessThan(POSITION_TOLERANCE);
  });
});
