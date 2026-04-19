/**
 * ObstacleSpawner unit tests — obstacle + pickup streaming, recycling,
 * lane placement, radius mapping, scare mechanics, consume, reset, and
 * spawnAtExact helper.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ObstacleSpawner } from '@/game/obstacles/obstacleSpawner';
import type { ObstacleType } from '@/utils/constants';
import { HONK, TRACK } from '@/utils/constants';
import { createRng } from '@/utils/rng';

describe('ObstacleSpawner', () => {
  let sp: ObstacleSpawner;

  beforeEach(() => {
    sp = new ObstacleSpawner(createRng(42));
  });

  describe('update — streaming', () => {
    it('spawns obstacles ahead of the player', () => {
      sp.update(0, 'midway-strip');
      const os = sp.getObstacles();
      expect(os.length).toBeGreaterThan(0);
      for (const o of os) {
        expect(o.d).toBeGreaterThanOrEqual(80); // initial nextObstacleD
        expect(o.d).toBeLessThan(500);
      }
    });

    it('spawns pickups ahead of the player', () => {
      sp.update(0, 'midway-strip');
      const ps = sp.getPickups();
      expect(ps.length).toBeGreaterThan(0);
      for (const p of ps) {
        expect(p.d).toBeGreaterThanOrEqual(60);
        expect(p.d).toBeLessThan(500);
      }
    });

    it('respects the lookAheadD argument', () => {
      sp.update(0, 'midway-strip', 200);
      for (const o of sp.getObstacles()) {
        expect(o.d).toBeLessThan(200);
      }
    });

    it('obstacles use minGap = 18 between spawns (+ jitter 0..22)', () => {
      sp.update(0, 'midway-strip');
      const os = [...sp.getObstacles()].sort((a, b) => a.d - b.d);
      for (let i = 1; i < os.length; i++) {
        const gap = (os[i]?.d ?? 0) - (os[i - 1]?.d ?? 0);
        expect(gap).toBeGreaterThanOrEqual(18);
        expect(gap).toBeLessThanOrEqual(40);
      }
    });

    it('pickups use pickupMinGap = 35 between spawns (+ jitter 0..30)', () => {
      sp.update(0, 'midway-strip');
      const ps = [...sp.getPickups()].sort((a, b) => a.d - b.d);
      for (let i = 1; i < ps.length; i++) {
        const gap = (ps[i]?.d ?? 0) - (ps[i - 1]?.d ?? 0);
        expect(gap).toBeGreaterThanOrEqual(35);
        expect(gap).toBeLessThanOrEqual(65);
      }
    });

    it('recycles obstacles that fall more than 40m behind the player', () => {
      sp.update(0, 'midway-strip');
      const before = sp.getObstacles().length;
      expect(before).toBeGreaterThan(0);
      // Jump player far forward; cutoff = playerD - 40.
      sp.update(2000, 'midway-strip');
      for (const o of sp.getObstacles()) {
        expect(o.d).toBeGreaterThan(2000 - 40);
      }
    });
  });

  describe('spawnObstacle details', () => {
    it('every obstacle lands in a valid lane [0, LANE_COUNT)', () => {
      sp.update(0, 'midway-strip');
      for (const o of sp.getObstacles()) {
        expect(o.lane).toBeGreaterThanOrEqual(0);
        expect(o.lane).toBeLessThan(TRACK.LANE_COUNT);
        expect(Number.isInteger(o.lane)).toBe(true);
      }
    });

    it('maps obstacle type → radius correctly', () => {
      sp.update(0, 'midway-strip');
      const expectedRadius = (type: ObstacleType): number => {
        if (type === 'gate') return 3;
        if (type === 'oil') return 2.2;
        if (type === 'critter') return 1.8;
        return 1.6;
      };
      for (const o of sp.getObstacles()) {
        expect(o.radius).toBe(expectedRadius(o.type));
      }
    });

    it('critter obstacles get a critter kind assigned', () => {
      // Run many spawns to guarantee at least one critter
      sp.update(0, 'funhouse-frenzy');
      sp.update(1000, 'funhouse-frenzy');
      const critters = sp.getObstacles().filter((o) => o.type === 'critter');
      expect(critters.length).toBeGreaterThan(0);
      for (const c of critters) {
        expect(['cow', 'horse', 'llama', 'pig']).toContain(c.critter);
      }
    });

    it('non-critter obstacles have no critter field', () => {
      sp.update(0, 'midway-strip');
      for (const o of sp.getObstacles()) {
        if (o.type !== 'critter') {
          expect(o.critter).toBeUndefined();
        }
      }
    });

    it('ring-of-fire never spawns in its non-weighted path (all weights > 0 → some of every type is possible)', () => {
      // Ring-of-fire has hammer weight 2, oil weight 3 etc — nothing weight 0.
      sp.update(0, 'ring-of-fire');
      expect(sp.getObstacles().length).toBeGreaterThan(0);
    });

    it('midway-strip never spawns a hammer (weight 0)', () => {
      // Run plenty of spawns to exercise the weighted pick.
      for (let pd = 0; pd < 4000; pd += 500) sp.update(pd, 'midway-strip');
      const hammers = sp.getObstacles().filter((o) => o.type === 'hammer');
      expect(hammers).toHaveLength(0);
    });
  });

  describe('spawnPickup details', () => {
    it('every pickup lands at y = 1.6 (hovering)', () => {
      sp.update(0, 'midway-strip');
      for (const p of sp.getPickups()) {
        expect(p.y).toBeCloseTo(1.6, 6);
      }
    });

    it('every pickup has a valid type + radius mapping', () => {
      sp.update(0, 'midway-strip');
      for (const p of sp.getPickups()) {
        expect(['boost', 'ticket', 'mega']).toContain(p.type);
        expect(p.radius).toBe(p.type === 'mega' ? 2.2 : 1.4);
      }
    });

    it('pickups start not-consumed', () => {
      sp.update(0, 'midway-strip');
      for (const p of sp.getPickups()) {
        expect(p.consumed).toBe(false);
      }
    });
  });

  describe('scareCritters', () => {
    it('scares critters within HONK.SCARE_RADIUS_M ahead of the player', () => {
      // HONK.SCARE_RADIUS_M = 30, player at d=40 → covers [40, 70]
      sp.spawnAtExact(50, 1, 'critter'); // ahead 10 ✓
      sp.spawnAtExact(65, 2, 'critter'); // ahead 25 ✓
      sp.spawnAtExact(200, 1, 'critter'); // too far
      sp.spawnAtExact(30, 0, 'critter'); // behind player
      const count = sp.scareCritters(40, 1000);
      expect(count).toBe(2);
    });

    it('marks scared critters with fleeStartedAt and fleeDir', () => {
      sp.spawnAtExact(50, 1, 'critter');
      sp.scareCritters(40, 12_345);
      const c = sp.getObstacles()[0];
      expect(c?.fleeStartedAt).toBe(12_345);
      expect([-1, 1]).toContain(c?.fleeDir);
    });

    it('does not rescare an already-fleeing critter', () => {
      sp.spawnAtExact(50, 1, 'critter');
      expect(sp.scareCritters(40, 1000)).toBe(1);
      expect(sp.scareCritters(40, 2000)).toBe(0);
    });

    it('ignores non-critter obstacles', () => {
      sp.spawnAtExact(50, 1, 'barrier');
      expect(sp.scareCritters(40, 0)).toBe(0);
    });

    it('respects the scare radius cutoff', () => {
      sp.spawnAtExact(40 + HONK.SCARE_RADIUS_M + 1, 1, 'critter');
      expect(sp.scareCritters(40, 0)).toBe(0);
    });
  });

  describe('consumePickup', () => {
    it('marks the matching pickup as consumed', () => {
      sp.update(0, 'midway-strip');
      const p = sp.getPickups()[0];
      if (!p) return;
      sp.consumePickup(p.id);
      const entry = sp.getPickups().find((x) => x.id === p.id);
      expect(entry?.consumed ?? true).toBe(true);
    });

    it('is a no-op for unknown ids', () => {
      sp.update(0, 'midway-strip');
      expect(() => sp.consumePickup(999_999)).not.toThrow();
    });

    it('consumed pickups are filtered out on next update', () => {
      sp.update(0, 'midway-strip');
      const p = sp.getPickups()[0];
      if (!p) return;
      sp.consumePickup(p.id);
      sp.update(0, 'midway-strip');
      expect(sp.getPickups().find((x) => x.id === p.id)).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('clears obstacles and pickups', () => {
      sp.update(0, 'midway-strip');
      expect(sp.getObstacles().length).toBeGreaterThan(0);
      sp.reset();
      expect(sp.getObstacles()).toEqual([]);
      expect(sp.getPickups()).toEqual([]);
    });

    it('after reset(playerD), next spawns start ahead of playerD', () => {
      sp.update(0, 'midway-strip');
      sp.reset(2000);
      sp.update(2000, 'midway-strip');
      for (const o of sp.getObstacles()) expect(o.d).toBeGreaterThanOrEqual(2080);
      for (const p of sp.getPickups()) expect(p.d).toBeGreaterThanOrEqual(2060);
    });
  });

  describe('spawnAtExact', () => {
    it('places an obstacle at the exact d and lane given', () => {
      sp.spawnAtExact(300, 2, 'oil');
      const o = sp.getObstacles()[0];
      expect(o?.d).toBe(300);
      expect(o?.lane).toBe(2);
      expect(o?.type).toBe('oil');
      expect(o?.radius).toBe(2.2);
    });

    it('assigns critter = cow when type=critter (deterministic for tests)', () => {
      sp.spawnAtExact(100, 1, 'critter');
      expect(sp.getObstacles()[0]?.critter).toBe('cow');
    });

    it('assigns unique ids to each obstacle', () => {
      sp.spawnAtExact(100, 0, 'barrier');
      sp.spawnAtExact(200, 0, 'barrier');
      sp.spawnAtExact(300, 0, 'barrier');
      const ids = sp.getObstacles().map((o) => o.id);
      expect(new Set(ids).size).toBe(3);
    });
  });

  describe('determinism', () => {
    it('same seed → same obstacle + pickup sequences', () => {
      const a = new ObstacleSpawner(createRng(99));
      const b = new ObstacleSpawner(createRng(99));
      a.update(0, 'midway-strip');
      b.update(0, 'midway-strip');
      const ao = a.getObstacles();
      const bo = b.getObstacles();
      expect(ao.length).toBe(bo.length);
      for (let i = 0; i < ao.length; i++) {
        expect(ao[i]?.d).toBe(bo[i]?.d);
        expect(ao[i]?.type).toBe(bo[i]?.type);
        expect(ao[i]?.lane).toBe(bo[i]?.lane);
      }
    });
  });
});
