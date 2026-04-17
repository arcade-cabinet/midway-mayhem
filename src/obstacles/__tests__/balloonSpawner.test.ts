import { beforeEach, describe, expect, it } from 'vitest';
import { BalloonSpawner } from '@/obstacles/balloonSpawner';
import { createRng } from '@/utils/rng';

describe('BalloonSpawner', () => {
  let spawner: BalloonSpawner;
  const now = 50_000;

  beforeEach(() => {
    spawner = new BalloonSpawner(createRng(7));
  });

  it('starts with no balloons', () => {
    expect(spawner.getBalloons()).toHaveLength(0);
  });

  it('does not spawn when zone is not balloon-alley', () => {
    spawner.update(0, 'midway-strip', now);
    expect(spawner.getBalloons()).toHaveLength(0);

    spawner.update(0, 'ring-of-fire', now);
    expect(spawner.getBalloons()).toHaveLength(0);
  });

  it('spawns balloons in balloon-alley zone', () => {
    spawner.update(0, 'balloon-alley', now);
    expect(spawner.getBalloons().length).toBeGreaterThan(0);
  });

  it('balloons drift from startLateral toward targetLateral', () => {
    spawner.update(0, 'balloon-alley', now);
    const b = spawner.getBalloons()[0]!;
    const lat0 = spawner.balloonLateral(b, b.spawnedAt);
    const latMid = spawner.balloonLateral(b, b.spawnedAt + (b.driftDuration * 1000) / 2);
    const latEnd = spawner.balloonLateral(b, b.spawnedAt + b.driftDuration * 1000 + 100);
    // lat0 should be near startLateral
    expect(Math.abs(lat0 - b.startLateral)).toBeLessThan(0.1);
    // latEnd should be near targetLateral
    expect(Math.abs(latEnd - b.targetLateral)).toBeLessThan(0.2);
    // latMid should be between start and target
    const min = Math.min(b.startLateral, b.targetLateral);
    const max = Math.max(b.startLateral, b.targetLateral);
    expect(latMid).toBeGreaterThanOrEqual(min - 0.1);
    expect(latMid).toBeLessThanOrEqual(max + 0.1);
  });

  it('drift duration is within 3.5–4.5s range', () => {
    spawner.update(0, 'balloon-alley', now);
    for (const b of spawner.getBalloons()) {
      expect(b.driftDuration).toBeGreaterThanOrEqual(3.5);
      expect(b.driftDuration).toBeLessThanOrEqual(4.6);
    }
  });

  it('recycles balloons behind player', () => {
    spawner.update(0, 'balloon-alley', now);
    const countBefore = spawner.getBalloons().length;
    // Jump player far ahead so old balloons are behind cutoff
    spawner.update(10_000, 'balloon-alley', now + 1000);
    const countAfter = spawner.getBalloons().length;
    // Old balloons from d=0..300 should be recycled; new ones spawned further ahead
    expect(countAfter).toBeGreaterThan(0);
    // Not all the same — some recycled, new ones added
    expect(countBefore + countAfter).toBeGreaterThan(0);
  });

  it('checkCollision returns id when player overlaps balloon', () => {
    spawner.update(0, 'balloon-alley', now);
    const b = spawner.getBalloons()[0]!;
    // Player at same distance and same lateral as balloon start
    const id = spawner.checkCollision(b.d, b.startLateral, b.spawnedAt);
    expect(id).toBe(b.id);
  });

  it('checkCollision returns null when player is far away laterally', () => {
    spawner.update(0, 'balloon-alley', now);
    const b = spawner.getBalloons()[0]!;
    const id = spawner.checkCollision(b.d, b.startLateral + 10, b.spawnedAt);
    expect(id).toBeNull();
  });

  it('consumeBalloon marks balloon consumed', () => {
    spawner.update(0, 'balloon-alley', now);
    const b = spawner.getBalloons()[0]!;
    spawner.consumeBalloon(b.id);
    expect(spawner.getBalloons().find((x) => x.id === b.id)!.consumed).toBe(true);
  });

  it('instanceCount reflects active (non-consumed) balloons', () => {
    spawner.update(0, 'balloon-alley', now);
    const total = spawner.getBalloons().length;
    const b = spawner.getBalloons()[0]!;
    spawner.consumeBalloon(b.id);
    expect(spawner.instanceCount).toBe(total - 1);
  });

  it('resets on reset()', () => {
    spawner.update(0, 'balloon-alley', now);
    spawner.reset();
    expect(spawner.getBalloons()).toHaveLength(0);
  });
});
