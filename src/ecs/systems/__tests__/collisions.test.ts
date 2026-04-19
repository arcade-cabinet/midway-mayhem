/**
 * ecs/systems/collisions unit tests — covers the obstacle + pickup
 * consumption flags and onObstacle / onPickup callbacks, plus the
 * broadphase culling. Note: Score + Speed mutations inside stepCollisions
 * write to a snapshot (not a live SoA ref) so we don't assert those here;
 * the consume + callback surface is the verifiable contract.
 */
import { createWorld } from 'koota';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stepCollisions } from '@/ecs/systems/collisions';
import {
  Obstacle,
  type ObstacleKind,
  Pickup,
  type PickupKind,
  Player,
  Position,
  Score,
  Speed,
} from '@/ecs/traits';
import { combo } from '@/game/comboSystem';

function spawnPlayer(
  w: ReturnType<typeof createWorld>,
  opts: { distance?: number; lateral?: number; speed?: number } = {},
) {
  return w.spawn(
    Player,
    Position({ distance: opts.distance ?? 0, lateral: opts.lateral ?? 0 }),
    Speed({ value: opts.speed ?? 30, target: opts.speed ?? 30 }),
    Score(),
  );
}

function spawnObstacle(
  w: ReturnType<typeof createWorld>,
  kind: ObstacleKind,
  distance: number,
  lateral = 0,
) {
  return w.spawn(Obstacle({ kind, distance, lateral, consumed: false }));
}

function spawnPickup(
  w: ReturnType<typeof createWorld>,
  kind: PickupKind,
  distance: number,
  lateral = 0,
) {
  return w.spawn(Pickup({ kind, distance, lateral, consumed: false }));
}

const _worlds: ReturnType<typeof createWorld>[] = [];
function freshWorld(): ReturnType<typeof createWorld> {
  const w = createWorld();
  _worlds.push(w);
  return w;
}

beforeEach(() => {
  combo.reset();
});

afterEach(() => {
  while (_worlds.length) _worlds.pop()?.destroy();
});

describe('stepCollisions', () => {
  it('is a no-op when no player exists', () => {
    const w = freshWorld();
    expect(() => stepCollisions(w, 1 / 60)).not.toThrow();
  });

  it('ignores obstacles outside the interest band [-8, +12]m ahead', () => {
    const w = freshWorld();
    spawnPlayer(w, { distance: 0 });
    const behind = spawnObstacle(w, 'cone', -20, 0);
    const aheadFar = spawnObstacle(w, 'cone', 50, 0);
    stepCollisions(w, 1 / 60);
    expect(behind.get(Obstacle)?.consumed).toBe(false);
    expect(aheadFar.get(Obstacle)?.consumed).toBe(false);
  });

  it('consumes a direct-hit obstacle and fires onObstacle with its kind', () => {
    const w = freshWorld();
    spawnPlayer(w);
    const ob = spawnObstacle(w, 'barrier', 1.5, 0);
    const onObstacle = vi.fn();
    stepCollisions(w, 1 / 60, { onObstacle });
    expect(ob.get(Obstacle)?.consumed).toBe(true);
    expect(onObstacle).toHaveBeenCalledWith('barrier');
  });

  it('fires onObstacle for each of the 6 ObstacleKinds', () => {
    const kinds: ObstacleKind[] = ['barrier', 'cone', 'gate', 'oil', 'hammer', 'critter'];
    for (const k of kinds) {
      const w = freshWorld();
      spawnPlayer(w);
      spawnObstacle(w, k, 1, 0);
      const onObstacle = vi.fn();
      stepCollisions(w, 1 / 60, { onObstacle });
      expect(onObstacle).toHaveBeenCalledWith(k);
    }
  });

  it('near-miss band (HIT_LATERAL..NEAR_MISS_LATERAL): consumes obstacle but does NOT call onObstacle', () => {
    const w = freshWorld();
    spawnPlayer(w, { lateral: 0 });
    const ob = spawnObstacle(w, 'cone', 1, 2.0);
    const onObstacle = vi.fn();
    stepCollisions(w, 1 / 60, { onObstacle });
    expect(ob.get(Obstacle)?.consumed).toBe(true);
    expect(onObstacle).not.toHaveBeenCalled();
  });

  it('outside NEAR_MISS_LATERAL band: obstacle untouched', () => {
    const w = freshWorld();
    spawnPlayer(w, { lateral: 0 });
    const ob = spawnObstacle(w, 'cone', 1, 4.0);
    stepCollisions(w, 1 / 60);
    expect(ob.get(Obstacle)?.consumed).toBe(false);
  });

  it('already-consumed obstacles are skipped', () => {
    const w = freshWorld();
    spawnPlayer(w);
    const ob = w.spawn(Obstacle({ kind: 'barrier', distance: 1, lateral: 0, consumed: true }));
    const onObstacle = vi.fn();
    stepCollisions(w, 1 / 60, { onObstacle });
    expect(onObstacle).not.toHaveBeenCalled();
    expect(ob.get(Obstacle)?.consumed).toBe(true);
  });

  it('pickup consume + onPickup callback fires for each PickupKind', () => {
    const kinds: PickupKind[] = ['balloon', 'boost', 'mega'];
    for (const k of kinds) {
      const w = freshWorld();
      spawnPlayer(w);
      const p = spawnPickup(w, k, 1, 0);
      const onPickup = vi.fn();
      stepCollisions(w, 1 / 60, { onPickup });
      expect(p.get(Pickup)?.consumed).toBe(true);
      expect(onPickup).toHaveBeenCalledWith(k);
    }
  });

  it('pickup broadphase: outside [-4, +4] is ignored', () => {
    const w = freshWorld();
    spawnPlayer(w);
    const behind = spawnPickup(w, 'balloon', -10, 0);
    const far = spawnPickup(w, 'balloon', 10, 0);
    stepCollisions(w, 1 / 60);
    expect(behind.get(Pickup)?.consumed).toBe(false);
    expect(far.get(Pickup)?.consumed).toBe(false);
  });

  it('pickup lateral miss: outside HIT_LATERAL is not consumed', () => {
    const w = freshWorld();
    spawnPlayer(w, { lateral: 0 });
    const p = spawnPickup(w, 'balloon', 1, 3);
    stepCollisions(w, 1 / 60);
    expect(p.get(Pickup)?.consumed).toBe(false);
  });

  it('already-consumed pickups are skipped', () => {
    const w = freshWorld();
    spawnPlayer(w);
    const p = w.spawn(Pickup({ kind: 'balloon', distance: 1, lateral: 0, consumed: true }));
    const onPickup = vi.fn();
    stepCollisions(w, 1 / 60, { onPickup });
    expect(onPickup).not.toHaveBeenCalled();
    expect(p.get(Pickup)?.consumed).toBe(true);
  });

  it('works without callbacks (cb is optional)', () => {
    const w = freshWorld();
    spawnPlayer(w);
    spawnObstacle(w, 'cone', 1, 0);
    expect(() => stepCollisions(w, 1 / 60)).not.toThrow();
  });
});
