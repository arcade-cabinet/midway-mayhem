/**
 * BalloonSpawner unit tests — spawning gated on zone, drift animation,
 * collision, consume, and recycle behavior.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { BalloonSpawner } from '@/game/obstacles/balloonSpawner';
import { createRng } from '@/utils/rng';

describe('BalloonSpawner', () => {
  let sp: BalloonSpawner;

  beforeEach(() => {
    sp = new BalloonSpawner(createRng(42));
  });

  describe('update: zone gating', () => {
    it('does not spawn while outside balloon-alley', () => {
      sp.update(100, 'midway-strip', 0);
      expect(sp.getBalloons()).toHaveLength(0);
    });

    it('spawns balloons when zone is balloon-alley', () => {
      sp.update(100, 'balloon-alley', 0);
      expect(sp.instanceCount).toBeGreaterThan(0);
    });

    it('fills 300m lookahead ahead of the player', () => {
      sp.update(0, 'balloon-alley', 0);
      const bs = sp.getBalloons();
      for (const b of bs) {
        expect(b.d).toBeGreaterThanOrEqual(20); // minimum spawn offset
        expect(b.d).toBeLessThan(300);
      }
    });

    it('re-entering the zone resumes spawning ahead of current playerD', () => {
      sp.update(500, 'balloon-alley', 0);
      const firstCount = sp.instanceCount;
      expect(firstCount).toBeGreaterThan(0);
      // Leave zone
      sp.update(700, 'midway-strip', 0);
      // Come back — spawner should still have balloons ahead of new playerD
      sp.update(800, 'balloon-alley', 0);
      expect(sp.instanceCount).toBeGreaterThan(0);
    });
  });

  describe('balloonLateral', () => {
    it('returns startLateral at t=0', () => {
      sp.update(0, 'balloon-alley', 0);
      const b = sp.getBalloons()[0];
      expect(b).toBeDefined();
      if (!b) return;
      const lat = sp.balloonLateral(b, b.spawnedAt);
      expect(lat).toBeCloseTo(b.startLateral, 6);
    });

    it('returns targetLateral at t ≥ driftDuration', () => {
      sp.update(0, 'balloon-alley', 0);
      const b = sp.getBalloons()[0];
      if (!b) return;
      const lat = sp.balloonLateral(b, b.spawnedAt + (b.driftDuration + 1) * 1000);
      expect(lat).toBeCloseTo(b.targetLateral, 6);
    });

    it('midpoint time gives midpoint lateral (ease-in-out symmetric at t=0.5)', () => {
      sp.update(0, 'balloon-alley', 0);
      const b = sp.getBalloons()[0];
      if (!b) return;
      const lat = sp.balloonLateral(b, b.spawnedAt + (b.driftDuration / 2) * 1000);
      const mid = (b.startLateral + b.targetLateral) / 2;
      expect(lat).toBeCloseTo(mid, 5);
    });

    it('is deterministic — same inputs yield the same lateral', () => {
      sp.update(0, 'balloon-alley', 0);
      const b = sp.getBalloons()[0];
      if (!b) return;
      const a = sp.balloonLateral(b, b.spawnedAt + 500);
      const c = sp.balloonLateral(b, b.spawnedAt + 500);
      expect(a).toBe(c);
    });
  });

  describe('checkCollision', () => {
    it('returns null when no balloons exist', () => {
      expect(sp.checkCollision(100, 0, 0)).toBeNull();
    });

    it('returns null when player is > 4m away in d', () => {
      sp.update(0, 'balloon-alley', 0);
      const b = sp.getBalloons()[0];
      if (!b) return;
      // Far in distance
      expect(sp.checkCollision(b.d + 10, 0, b.spawnedAt)).toBeNull();
    });

    it('returns balloon id when player overlaps within 4m/2.5 lateral at spawn time', () => {
      sp.update(0, 'balloon-alley', 0);
      const b = sp.getBalloons()[0];
      if (!b) return;
      const hit = sp.checkCollision(b.d, b.startLateral, b.spawnedAt);
      expect(hit).toBe(b.id);
    });

    it('misses when lateral offset exceeds 2.5m', () => {
      sp.update(0, 'balloon-alley', 0);
      const b = sp.getBalloons()[0];
      if (!b) return;
      // Place player far from start lateral (beyond 2.5)
      const hit = sp.checkCollision(b.d, b.startLateral + 3, b.spawnedAt);
      expect(hit).toBeNull();
    });

    it('ignores consumed balloons', () => {
      sp.update(0, 'balloon-alley', 0);
      const b = sp.getBalloons()[0];
      if (!b) return;
      sp.consumeBalloon(b.id);
      expect(sp.checkCollision(b.d, b.startLateral, b.spawnedAt)).toBeNull();
    });
  });

  describe('consumeBalloon', () => {
    it('marks the target balloon as consumed', () => {
      sp.update(0, 'balloon-alley', 0);
      const b = sp.getBalloons()[0];
      if (!b) return;
      sp.consumeBalloon(b.id);
      const after = sp.getBalloons().find((x) => x.id === b.id);
      // After the next update, consumed balloons are filtered out of the list.
      // Until then, the entry should be flagged.
      expect(after?.consumed ?? true).toBe(true);
    });

    it('is a no-op for unknown ids', () => {
      sp.update(0, 'balloon-alley', 0);
      const before = sp.instanceCount;
      expect(() => sp.consumeBalloon(999_999)).not.toThrow();
      expect(sp.instanceCount).toBe(before);
    });

    it('instanceCount drops by one after consume', () => {
      sp.update(0, 'balloon-alley', 0);
      const before = sp.instanceCount;
      const b = sp.getBalloons()[0];
      if (!b) return;
      sp.consumeBalloon(b.id);
      expect(sp.instanceCount).toBe(before - 1);
    });
  });

  describe('recycle', () => {
    it('drops balloons that fall ≥40m behind the player', () => {
      sp.update(0, 'balloon-alley', 0);
      const startCount = sp.instanceCount;
      expect(startCount).toBeGreaterThan(0);
      // Jump the player 500m ahead; balloons spawned up to 300m are all now behind.
      sp.update(500, 'balloon-alley', 1000);
      // All prior balloons are well behind (playerD - 40 = 460). They should be gone
      // though new ones may spawn ahead.
      for (const b of sp.getBalloons()) {
        expect(b.d).toBeGreaterThan(460);
      }
    });

    it('filters consumed balloons on next update', () => {
      sp.update(0, 'balloon-alley', 0);
      const b = sp.getBalloons()[0];
      if (!b) return;
      sp.consumeBalloon(b.id);
      sp.update(0, 'balloon-alley', 1);
      const stillThere = sp.getBalloons().find((x) => x.id === b.id);
      expect(stillThere).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('clears balloons and the nextBalloonD cursor', () => {
      sp.update(100, 'balloon-alley', 0);
      expect(sp.instanceCount).toBeGreaterThan(0);
      sp.reset();
      expect(sp.instanceCount).toBe(0);
    });

    it('after reset, spawning picks up from the new player position', () => {
      sp.update(100, 'balloon-alley', 0);
      sp.reset();
      sp.update(5000, 'balloon-alley', 0);
      for (const b of sp.getBalloons()) {
        expect(b.d).toBeGreaterThanOrEqual(5020); // 5000 + 20 minimum spawn offset
      }
    });
  });

  describe('determinism', () => {
    it('same seed produces same balloon sequence', () => {
      const a = new BalloonSpawner(createRng(123));
      const b = new BalloonSpawner(createRng(123));
      a.update(0, 'balloon-alley', 0);
      b.update(0, 'balloon-alley', 0);
      const al = a.getBalloons();
      const bl = b.getBalloons();
      expect(al.length).toBe(bl.length);
      for (let i = 0; i < al.length; i++) {
        expect(al[i]?.d).toBe(bl[i]?.d);
        expect(al[i]?.color).toBe(bl[i]?.color);
      }
    });
  });
});
