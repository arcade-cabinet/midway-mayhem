/**
 * ecs/systems/collisions unit tests — covers the obstacle + pickup
 * consumption flags, onObstacle / onPickup callbacks, broadphase culling,
 * and the Score + Speed mutations applied to the player each tick.
 */

import { createWorld } from 'koota';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tunables } from '@/config';
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

  // ─── Score + Speed mutations ──────────────────────────────────────────────

  function getScore(w: ReturnType<typeof createWorld>) {
    return w.query(Player, Score)[0]?.get(Score);
  }
  function getSpeed(w: ReturnType<typeof createWorld>) {
    return w.query(Player, Speed)[0]?.get(Speed);
  }

  it('barrier hit applies +2 damage and 0.3× speed', () => {
    const w = freshWorld();
    spawnPlayer(w, { speed: 30 });
    spawnObstacle(w, 'barrier', 1.5, 0);
    stepCollisions(w, 1 / 60);
    expect(getScore(w)?.damage).toBe(2);
    expect(getSpeed(w)?.value).toBeCloseTo(30 * 0.3, 5);
  });

  it('cone hit: +1 damage, 0.6× speed', () => {
    const w = freshWorld();
    spawnPlayer(w, { speed: 30 });
    spawnObstacle(w, 'cone', 1, 0);
    stepCollisions(w, 1 / 60);
    expect(getScore(w)?.damage).toBe(1);
    expect(getSpeed(w)?.value).toBeCloseTo(30 * 0.6, 5);
  });

  it('gate hit: +1 damage, 0.75× speed', () => {
    const w = freshWorld();
    spawnPlayer(w, { speed: 30 });
    spawnObstacle(w, 'gate', 1, 0);
    stepCollisions(w, 1 / 60);
    expect(getScore(w)?.damage).toBe(1);
    expect(getSpeed(w)?.value).toBeCloseTo(30 * 0.75, 5);
  });

  it('oil hit: no damage, 0.5× speed', () => {
    const w = freshWorld();
    spawnPlayer(w, { speed: 30 });
    spawnObstacle(w, 'oil', 1, 0);
    stepCollisions(w, 1 / 60);
    expect(getScore(w)?.damage).toBe(0);
    expect(getSpeed(w)?.value).toBeCloseTo(30 * 0.5, 5);
  });

  it('hammer hit: +2 damage, 0.4× speed', () => {
    const w = freshWorld();
    spawnPlayer(w, { speed: 30 });
    spawnObstacle(w, 'hammer', 1, 0);
    stepCollisions(w, 1 / 60);
    expect(getScore(w)?.damage).toBe(2);
    expect(getSpeed(w)?.value).toBeCloseTo(30 * 0.4, 5);
  });

  it('near-miss adds +5 to score.value', () => {
    const w = freshWorld();
    spawnPlayer(w, { lateral: 0, speed: 0 });
    spawnObstacle(w, 'cone', 1, 2.0);
    stepCollisions(w, 1 / 60);
    const s = getScore(w);
    // Near-miss bonus 5 plus speed*dt*(1+clean*0.02); speed=0 → only 5.
    expect(s?.value).toBeCloseTo(5, 5);
    expect(s?.damage).toBe(0);
  });

  it('balloon pickup: +100 to value, +1 balloon', () => {
    const w = freshWorld();
    spawnPlayer(w, { speed: 0 });
    spawnPickup(w, 'balloon', 1, 0);
    stepCollisions(w, 1 / 60);
    const s = getScore(w);
    expect(s?.balloons).toBe(1);
    expect(s?.value).toBeCloseTo(100, 5);
  });

  it('boost pickup sets boostRemaining to ~2.5s (minus this tick)', () => {
    const w = freshWorld();
    spawnPlayer(w);
    spawnPickup(w, 'boost', 1, 0);
    stepCollisions(w, 1 / 60);
    const rem = getScore(w)?.boostRemaining ?? 0;
    expect(rem).toBeGreaterThan(2.4);
    expect(rem).toBeLessThan(2.5);
  });

  it('mega pickup raises boostRemaining to ~3.5 and adds +250', () => {
    const w = freshWorld();
    spawnPlayer(w, { speed: 0 });
    spawnPickup(w, 'mega', 1, 0);
    stepCollisions(w, 1 / 60);
    const s = getScore(w);
    expect(s?.boostRemaining).toBeGreaterThan(3.4);
    expect(s?.value).toBeGreaterThanOrEqual(250);
  });

  it('boost countdown ticks and overrides speed.target', () => {
    const w = freshWorld();
    spawnPlayer(w);
    spawnPickup(w, 'boost', 1, 0);
    stepCollisions(w, 1 / 60);
    const t0 = getScore(w)?.boostRemaining ?? 0;
    stepCollisions(w, 0.5);
    const t1 = getScore(w)?.boostRemaining ?? 0;
    expect(t1).toBeLessThan(t0);
    expect(getSpeed(w)?.target).toBeCloseTo(tunables.cruiseMps * 1.6, 3);
  });

  it('cleanSeconds accumulates each frame when no hits', () => {
    const w = freshWorld();
    spawnPlayer(w, { speed: 30 });
    stepCollisions(w, 1);
    const s1 = getScore(w)?.cleanSeconds ?? 0;
    stepCollisions(w, 1);
    const s2 = getScore(w)?.cleanSeconds ?? 0;
    expect(s2).toBeGreaterThan(s1);
  });

  it('a hit resets cleanSeconds (then +dt applied in the same tick)', () => {
    const w = freshWorld();
    spawnPlayer(w, { speed: 30 });
    // Ramp cleanSeconds first
    stepCollisions(w, 2);
    expect(getScore(w)?.cleanSeconds ?? 0).toBeGreaterThan(1);
    // Place barrier within broadphase band (< 12m ahead of player at 0)
    spawnObstacle(w, 'barrier', 1.5, 0);
    stepCollisions(w, 1 / 60);
    // cleanSeconds reset happens, then += dt → close to dt
    expect(getScore(w)?.cleanSeconds ?? 99).toBeLessThan(0.1);
  });

  // ─── Regression: #130 centered-player-hits-adjacent-lane-obstacles ───
  // Prior to the fix, HIT_LATERAL was exactly halfLaneWidth (1.6). An
  // obstacle at a computed lane centre via the spawner formula
  // `-halfWidth + laneWidth*(lane+0.5)` yields ±1.5999999999999996 due
  // to IEEE754 drift — which is < 1.6 and registered as a hit for a
  // centered player. Every run ended at d≈223 with sanity=100, zero
  // input. These tests pin the fix.
  it('#130 — obstacle at spawner-formula lane-1 centre does NOT hit centered player', () => {
    const w = freshWorld();
    spawnPlayer(w, { lateral: 0, speed: 30 });
    // Re-create the exact spawnContent lane-centre value. laneWidth=3.2,
    // lanes=4, halfWidth=6.4. lane=1 centre = -6.4 + 3.2*1.5 which in
    // IEEE754 is -1.5999999999999996, NOT -1.6.
    const laneWidth = 3.2;
    const lanes = 4;
    const halfWidth = (laneWidth * lanes) / 2;
    const lane1Center = -halfWidth + laneWidth * (1 + 0.5);
    // Sanity — proves the FP drift the fix is immune to. The exact value
    // is -1.5999999999999996, whose |·| IS < 1.6, which is why the old
    // strict `< HIT_LATERAL=1.6` check hit a centered player.
    expect(lane1Center).toBeGreaterThan(-1.6);
    expect(Math.abs(lane1Center)).toBeLessThan(1.6);
    spawnObstacle(w, 'barrier', 1.5, lane1Center);
    stepCollisions(w, 1 / 60);
    expect(getScore(w)?.damage).toBe(0);
  });

  it('#130 — obstacle at spawner-formula lane-2 centre does NOT hit centered player', () => {
    const w = freshWorld();
    spawnPlayer(w, { lateral: 0, speed: 30 });
    const laneWidth = 3.2;
    const lanes = 4;
    const halfWidth = (laneWidth * lanes) / 2;
    const lane2Center = -halfWidth + laneWidth * (2 + 0.5); // ≈ +1.6
    spawnObstacle(w, 'cone', 1.5, lane2Center);
    stepCollisions(w, 1 / 60);
    expect(getScore(w)?.damage).toBe(0);
  });

  it('#130 — 4-lane track with an obstacle in every adjacent-lane does not end a zero-input run', () => {
    const w = freshWorld();
    spawnPlayer(w, { lateral: 0, speed: 30 });
    const laneWidth = 3.2;
    const lanes = 4;
    const halfWidth = (laneWidth * lanes) / 2;
    // Seed one obstacle in every inner lane (where the adjacency-collision bug hit).
    for (const lane of [1, 2] as const) {
      const laneCenter = -halfWidth + laneWidth * (lane + 0.5);
      spawnObstacle(w, 'barrier', 1.5, laneCenter);
    }
    stepCollisions(w, 1 / 60);
    expect(getScore(w)?.damage).toBe(0);
  });
});
