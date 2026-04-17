import { beforeEach, describe, expect, it } from 'vitest';
import { createRng } from '@/utils/rng';
import { ObstacleSpawner } from '@/obstacles/obstacleSpawner';

describe('ObstacleSpawner', () => {
  let spawner: ObstacleSpawner;

  beforeEach(() => {
    spawner = new ObstacleSpawner(createRng(42));
  });

  it('spawns obstacles in the lookahead window', () => {
    spawner.update(0, 'midway-strip', 500);
    const list = spawner.getObstacles();
    expect(list.length).toBeGreaterThan(0);
    for (const o of list) {
      expect(o.d).toBeGreaterThanOrEqual(0);
      expect(o.d).toBeLessThanOrEqual(500);
    }
  });

  it('consumePickup marks it as consumed', () => {
    spawner.update(0, 'midway-strip');
    const pickups = spawner.getPickups();
    // Seed 42 must produce at least one pickup; if the spawner changes this test should surface it
    expect(pickups.length).toBeGreaterThan(0);
    const first = pickups[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(first.consumed).toBe(false);
    spawner.consumePickup(first.id);
    expect(first.consumed).toBe(true);
  });

  it('recycles obstacles past the player', () => {
    spawner.update(0, 'midway-strip');
    const initial = spawner.getObstacles().length;
    expect(initial).toBeGreaterThan(0);
    // Jump far ahead; old obstacles should be removed
    spawner.update(1000, 'midway-strip');
    const list = spawner.getObstacles();
    for (const o of list) {
      expect(o.d).toBeGreaterThan(1000 - 50); // cutoff ~ playerD - 40
    }
  });

  it('is deterministic for the same seed', () => {
    const a = new ObstacleSpawner(createRng(99));
    const b = new ObstacleSpawner(createRng(99));
    a.update(0, 'midway-strip', 200);
    b.update(0, 'midway-strip', 200);
    const la = a.getObstacles();
    const lb = b.getObstacles();
    expect(la.length).toBe(lb.length);
    for (let i = 0; i < la.length; i++) {
      const ai = la[i];
      const bi = lb[i];
      expect(ai).toBeDefined();
      expect(bi).toBeDefined();
      if (!ai || !bi) continue;
      expect(ai.type).toBe(bi.type);
      expect(ai.lane).toBe(bi.lane);
      expect(ai.d).toBeCloseTo(bi.d, 3);
    }
  });

  it('spawns different obstacle distributions across zones', () => {
    const midway = new ObstacleSpawner(createRng(7));
    midway.update(0, 'midway-strip', 800);
    const ringFire = new ObstacleSpawner(createRng(7));
    ringFire.update(0, 'ring-of-fire', 800);
    const midwayTypes = midway.getObstacles().map((o) => o.type);
    const ringTypes = ringFire.getObstacles().map((o) => o.type);
    // midway-strip has hammer weight 0; ring-of-fire has hammer weight 2
    expect(midwayTypes.includes('hammer')).toBe(false);
    expect(ringTypes.includes('hammer')).toBe(true);
  });

  it('reset clears the pools', () => {
    spawner.update(0, 'midway-strip');
    expect(spawner.getObstacles().length).toBeGreaterThan(0);
    spawner.reset();
    expect(spawner.getObstacles().length).toBe(0);
    expect(spawner.getPickups().length).toBe(0);
  });
});
