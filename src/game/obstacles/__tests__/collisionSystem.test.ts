/**
 * collisionSystem unit tests — sphere-based XZ collision on obstacles
 * and pickups. Pure function; no ECS/render coupling.
 */
import { describe, expect, it } from 'vitest';
import { detectCollisions, type PlayerPose } from '@/game/obstacles/collisionSystem';
import type { Obstacle, Pickup } from '@/game/obstacles/obstacleSpawner';

function makeObstacle(overrides: Partial<Obstacle> = {}): Obstacle {
  return {
    id: 1,
    type: 'barrier',
    d: 0,
    lane: 0,
    x: 0,
    y: 0,
    z: 0,
    swingPhase: 0,
    radius: 1,
    ...overrides,
  };
}

function makePickup(overrides: Partial<Pickup> = {}): Pickup {
  return {
    id: 1,
    type: 'ticket',
    d: 0,
    lane: 0,
    x: 0,
    y: 0,
    z: 0,
    consumed: false,
    radius: 1,
    ...overrides,
  };
}

const PLAYER: PlayerPose = { d: 0, x: 0, z: 0, radius: 1 };

describe('detectCollisions', () => {
  it('reports no hits when arrays are empty', () => {
    const r = detectCollisions(PLAYER, [], []);
    expect(r.obstacleHits).toEqual([]);
    expect(r.pickupHits).toEqual([]);
  });

  it('detects an overlapping obstacle at the same position', () => {
    const o = makeObstacle({ x: 0, z: 0 });
    const r = detectCollisions(PLAYER, [o], []);
    expect(r.obstacleHits).toEqual([o]);
  });

  it('skips obstacles more than 8m away in d (broadphase cull)', () => {
    const far = makeObstacle({ d: 20, x: 0, z: 0 });
    const r = detectCollisions(PLAYER, [far], []);
    expect(r.obstacleHits).toEqual([]);
  });

  it('misses when XZ distance exceeds sum of radii', () => {
    // player radius 1 + obstacle radius 1 = 2 → anything at distance > 2 misses.
    const o = makeObstacle({ x: 3, z: 0 });
    const r = detectCollisions(PLAYER, [o], []);
    expect(r.obstacleHits).toEqual([]);
  });

  it('hits when XZ distance is just under the summed radius', () => {
    const o = makeObstacle({ x: 1.9, z: 0 });
    const r = detectCollisions(PLAYER, [o], []);
    expect(r.obstacleHits).toEqual([o]);
  });

  it('misses at exactly summed radii (strict less-than)', () => {
    const o = makeObstacle({ x: 2, z: 0 });
    const r = detectCollisions(PLAYER, [o], []);
    expect(r.obstacleHits).toEqual([]);
  });

  it('ignores consumed pickups', () => {
    const p = makePickup({ x: 0, z: 0, consumed: true });
    const r = detectCollisions(PLAYER, [], [p]);
    expect(r.pickupHits).toEqual([]);
  });

  it('detects fresh pickups with the same collision math', () => {
    const p = makePickup({ x: 0.5, z: 0 });
    const r = detectCollisions(PLAYER, [], [p]);
    expect(r.pickupHits).toEqual([p]);
  });

  it('can return multiple simultaneous obstacle hits', () => {
    const a = makeObstacle({ id: 1, x: 0, z: 0 });
    const b = makeObstacle({ id: 2, x: 0.3, z: 0 });
    const r = detectCollisions(PLAYER, [a, b], []);
    expect(r.obstacleHits).toHaveLength(2);
  });

  it('distance broadphase uses |o.d - player.d|, inclusive at 8m', () => {
    // just over 8 → culled
    const farD = makeObstacle({ d: 9, x: 0, z: 0 });
    expect(detectCollisions(PLAYER, [farD], []).obstacleHits).toEqual([]);
    // at exactly 8 → culled (strict > 8 check, so 8 passes broadphase)
    const atD = makeObstacle({ d: 8, x: 0, z: 0 });
    expect(detectCollisions(PLAYER, [atD], []).obstacleHits).toEqual([atD]);
  });

  it('respects varying player radius (big rig collides at larger distances)', () => {
    const o = makeObstacle({ x: 2.5, z: 0 });
    const small = detectCollisions({ ...PLAYER, radius: 1 }, [o], []);
    const big = detectCollisions({ ...PLAYER, radius: 2 }, [o], []);
    expect(small.obstacleHits).toEqual([]);
    expect(big.obstacleHits).toEqual([o]);
  });

  it('is deterministic (pure function)', () => {
    const obstacles = [makeObstacle({ id: 1, x: 0 }), makeObstacle({ id: 2, x: 10 })];
    const pickups = [makePickup({ id: 3 })];
    const a = detectCollisions(PLAYER, obstacles, pickups);
    const b = detectCollisions(PLAYER, obstacles, pickups);
    expect(a).toEqual(b);
  });
});
