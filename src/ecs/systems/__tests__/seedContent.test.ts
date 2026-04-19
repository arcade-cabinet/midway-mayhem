/**
 * seedContent unit tests — deterministic obstacle + pickup seeding,
 * lead-in respect, zone-weight adherence, lane snapping, critter/hammer
 * randomisation, and replay determinism.
 */
import { createWorld } from 'koota';
import { afterEach, describe, expect, it } from 'vitest';
import { trackArchetypes } from '@/config';
import { seedContent } from '@/ecs/systems/seedContent';
import { Obstacle, Pickup } from '@/ecs/traits';
import { CRITTER_KINDS } from '@/utils/constants';

const _worlds: ReturnType<typeof createWorld>[] = [];
function freshWorld(): ReturnType<typeof createWorld> {
  const w = createWorld();
  _worlds.push(w);
  return w;
}

afterEach(() => {
  while (_worlds.length) _worlds.pop()?.destroy();
});

interface ObstacleSnap {
  kind: 'barrier' | 'cone' | 'gate' | 'oil' | 'hammer' | 'critter';
  distance: number;
  lateral: number;
  consumed: boolean;
  critterKind: '' | 'cow' | 'horse' | 'llama' | 'pig';
  fleeStartedAt: number;
  fleeDir: -1 | 0 | 1;
  swingPhase: number;
}

interface PickupSnap {
  kind: 'balloon' | 'boost' | 'mega';
  distance: number;
  lateral: number;
  consumed: boolean;
}

function collectObstacles(w: ReturnType<typeof createWorld>): ObstacleSnap[] {
  const out: ObstacleSnap[] = [];
  w.query(Obstacle).forEach((e) => {
    const o = e.get(Obstacle);
    if (o) out.push(o as unknown as ObstacleSnap);
  });
  return out;
}

function collectPickups(w: ReturnType<typeof createWorld>): PickupSnap[] {
  const out: PickupSnap[] = [];
  w.query(Pickup).forEach((e) => {
    const p = e.get(Pickup);
    if (p) out.push(p as unknown as PickupSnap);
  });
  return out;
}

describe('seedContent', () => {
  it('spawns the default 30 obstacles and 40 pickups', () => {
    const w = freshWorld();
    seedContent(w, 42);
    expect(collectObstacles(w)).toHaveLength(30);
    expect(collectPickups(w)).toHaveLength(40);
  });

  it('respects obstacleCount + pickupCount overrides', () => {
    const w = freshWorld();
    seedContent(w, 42, { obstacleCount: 5, pickupCount: 3 });
    expect(collectObstacles(w)).toHaveLength(5);
    expect(collectPickups(w)).toHaveLength(3);
  });

  it('obstacleCount=0 + pickupCount=0 spawns nothing', () => {
    const w = freshWorld();
    seedContent(w, 42, { obstacleCount: 0, pickupCount: 0 });
    expect(collectObstacles(w)).toHaveLength(0);
    expect(collectPickups(w)).toHaveLength(0);
  });

  it('all spawns are at distance ≥ leadIn (default 40)', () => {
    const w = freshWorld();
    seedContent(w, 42);
    for (const o of collectObstacles(w)) expect(o.distance).toBeGreaterThanOrEqual(40);
    for (const p of collectPickups(w)) expect(p.distance).toBeGreaterThanOrEqual(40);
  });

  it('honours a custom leadIn', () => {
    const w = freshWorld();
    seedContent(w, 42, { leadIn: 200, obstacleCount: 50 });
    for (const o of collectObstacles(w)) expect(o.distance).toBeGreaterThanOrEqual(200);
  });

  it('lateral values snap to lane centres (halfWidth = lanes/2 × laneWidth)', () => {
    const w = freshWorld();
    seedContent(w, 42);
    const half = (trackArchetypes.laneWidth * trackArchetypes.lanes) / 2;
    const lw = trackArchetypes.laneWidth;
    const allowed = new Set<number>();
    for (let i = 0; i < trackArchetypes.lanes; i++) {
      allowed.add(-half + lw * (i + 0.5));
    }
    for (const o of collectObstacles(w)) {
      const match = [...allowed].some((a) => Math.abs(a - o.lateral) < 1e-6);
      expect(match).toBe(true);
    }
  });

  it('critter obstacles carry a CRITTER_KINDS critterKind; non-critters have empty string', () => {
    const w = freshWorld();
    seedContent(w, 42, { obstacleCount: 200 });
    for (const o of collectObstacles(w)) {
      if (o.kind === 'critter') {
        expect(CRITTER_KINDS).toContain(o.critterKind);
      } else {
        expect(o.critterKind).toBe('');
      }
    }
  });

  it('hammer obstacles get a non-zero swingPhase; non-hammers stay at 0', () => {
    const w = freshWorld();
    seedContent(w, 42, { obstacleCount: 200 });
    let sawHammer = false;
    for (const o of collectObstacles(w)) {
      if (o.kind === 'hammer') {
        sawHammer = true;
        expect(o.swingPhase).toBeGreaterThanOrEqual(0);
        expect(o.swingPhase).toBeLessThanOrEqual(Math.PI * 2);
      } else {
        expect(o.swingPhase).toBe(0);
      }
    }
    expect(sawHammer).toBe(true);
  });

  it('all obstacles start not-consumed + not-fleeing', () => {
    const w = freshWorld();
    seedContent(w, 42);
    for (const o of collectObstacles(w)) {
      expect(o.consumed).toBe(false);
      expect(o.fleeStartedAt).toBe(0);
      expect(o.fleeDir).toBe(0);
    }
  });

  it('all pickups start not-consumed', () => {
    const w = freshWorld();
    seedContent(w, 42);
    for (const p of collectPickups(w)) {
      expect(p.consumed).toBe(false);
    }
  });

  it('is deterministic: same seed → same obstacle + pickup sequences', () => {
    const w1 = freshWorld();
    const w2 = freshWorld();
    seedContent(w1, 12345);
    seedContent(w2, 12345);
    const a = collectObstacles(w1);
    const b = collectObstacles(w2);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]?.kind).toBe(b[i]?.kind);
      expect(a[i]?.distance).toBeCloseTo(b[i]?.distance ?? -1, 6);
      expect(a[i]?.lateral).toBeCloseTo(b[i]?.lateral ?? -1, 6);
    }
  });

  it('different seeds produce different placements', () => {
    const w1 = freshWorld();
    const w2 = freshWorld();
    seedContent(w1, 1);
    seedContent(w2, 2);
    const a = collectObstacles(w1);
    const b = collectObstacles(w2);
    // At least one placement should differ in distance or kind.
    let different = false;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i]?.kind !== b[i]?.kind || a[i]?.distance !== b[i]?.distance) {
        different = true;
        break;
      }
    }
    expect(different).toBe(true);
  });

  it('midway-strip zone never spawns hammers (weight 0)', () => {
    const w = freshWorld();
    // Seed with many obstacles; only ones landing in midway-strip (d 0..450)
    // should avoid hammer since that weight is 0.
    seedContent(w, 42, { obstacleCount: 500, leadIn: 40 });
    for (const o of collectObstacles(w)) {
      // Wrap into [0, cycle). zoneForDistance wraps at ZONE_CYCLE_M = 1800.
      const wrapped = ((o.distance % 1800) + 1800) % 1800;
      if (wrapped >= 0 && wrapped < 450) {
        expect(o.kind).not.toBe('hammer');
      }
    }
  });

  it('midway-strip zone never spawns mega pickups (weight 0)', () => {
    const w = freshWorld();
    seedContent(w, 42, { pickupCount: 500, leadIn: 40 });
    for (const p of collectPickups(w)) {
      const wrapped = ((p.distance % 1800) + 1800) % 1800;
      if (wrapped >= 0 && wrapped < 450) {
        expect(p.kind).not.toBe('mega');
      }
    }
  });
});
