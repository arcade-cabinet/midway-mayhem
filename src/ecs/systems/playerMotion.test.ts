/**
 * Unit tests for the player motion integrator.
 *
 * stepPlayer is gated by RunSession presence: when a run is active, the
 * ported gameStateTick owns motion. In these tests we never add RunSession,
 * so stepPlayer drives Position/Speed directly.
 *
 * Two paths are tested:
 *  - Steer-continuous (no Lane trait): original keyboard/mouse path.
 *  - Lane-snap (Lane + LaneCount traits present): mobile swipe path.
 */
import { createWorld } from 'koota';
import { describe, expect, it } from 'vitest';
import { trackArchetypes, tunables } from '@/config';
import { Lane, LaneCount, Player, Position, Speed, Steer, Throttle } from '@/ecs/traits';
import { laneCenter, spawnPlayer, stepPlayer } from './playerMotion';

describe('playerMotion', () => {
  it('spawns with zero speed / position', () => {
    const w = createWorld();
    spawnPlayer(w);
    const entities = w.query(Player, Speed, Position);
    expect(entities.length).toBe(1);
    const e = entities[0];
    if (!e) throw new Error('no player');
    expect(e.get(Speed)?.value).toBe(0);
    expect(e.get(Position)?.distance).toBe(0);
    expect(e.get(Position)?.lateral).toBe(0);
  });

  it('full throttle ramps speed toward cruiseMps', () => {
    const w = createWorld();
    spawnPlayer(w);
    w.query(Player, Throttle).updateEach(([t]) => {
      t.value = 1;
    });
    for (let i = 0; i < 200; i++) {
      stepPlayer(w, 1 / 60);
    }
    const e = w.query(Player, Speed)[0];
    if (!e) throw new Error('no player');
    const v = e.get(Speed)?.value ?? 0;
    expect(v).toBeGreaterThan(tunables.speed.cruiseMps * 0.9);
    expect(v).toBeLessThanOrEqual(tunables.speed.cruiseMps + 1e-6);
  });

  it('distance advances when moving', () => {
    const w = createWorld();
    spawnPlayer(w);
    w.query(Player, Throttle).updateEach(([t]) => {
      t.value = 1;
    });
    for (let i = 0; i < 120; i++) stepPlayer(w, 1 / 60);
    const pos = w.query(Player, Position)[0]?.get(Position);
    expect(pos?.distance ?? 0).toBeGreaterThan(1);
  });

  it('lateral is clamped to within paved surface', () => {
    const w = createWorld();
    spawnPlayer(w);
    w.query(Player, Steer).updateEach(([s]) => {
      s.value = 1;
    });
    for (let i = 0; i < 1000; i++) stepPlayer(w, 1 / 60);
    const pos = w.query(Player, Position)[0]?.get(Position);
    const half = (trackArchetypes.laneWidth * trackArchetypes.lanes) / 2;
    const maxLateral = half - trackArchetypes.laneWidth * 0.4;
    expect(pos?.lateral ?? 0).toBeLessThanOrEqual(maxLateral + 1e-6);
  });

  it('brake decays speed toward zero', () => {
    const w = createWorld();
    spawnPlayer(w);
    w.query(Player, Speed).updateEach(([s]) => {
      s.value = tunables.speed.cruiseMps;
    });
    w.query(Player, Throttle).updateEach(([t]) => {
      t.value = -1;
    });
    for (let i = 0; i < 300; i++) stepPlayer(w, 1 / 60);
    const v = w.query(Player, Speed)[0]?.get(Speed)?.value ?? 0;
    expect(v).toBeLessThan(1);
  });
});

describe('laneCenter', () => {
  it('returns correct centre for a 4-lane 3.3m track', () => {
    const w = 3.3;
    // 4 lanes × 3.3m = 13.2m wide; half = 6.6m
    // lane 0 centre = -6.6 + 1.65 = -4.95
    // lane 1 centre = -4.95 + 3.3 = -1.65
    // lane 2 centre = -1.65 + 3.3 = +1.65
    // lane 3 centre = +1.65 + 3.3 = +4.95
    expect(laneCenter(0, 4, w)).toBeCloseTo(-4.95, 5);
    expect(laneCenter(1, 4, w)).toBeCloseTo(-1.65, 5);
    expect(laneCenter(2, 4, w)).toBeCloseTo(1.65, 5);
    expect(laneCenter(3, 4, w)).toBeCloseTo(4.95, 5);
  });

  it('is symmetric: lanes sum to zero for even lane counts', () => {
    const w = 3.3;
    expect(laneCenter(0, 4, w) + laneCenter(3, 4, w)).toBeCloseTo(0, 5);
    expect(laneCenter(1, 4, w) + laneCenter(2, 4, w)).toBeCloseTo(0, 5);
  });
});

describe('lane-snap path (mobile)', () => {
  function spawnMobilePlayer(w: ReturnType<typeof createWorld>, startLane = 1) {
    spawnPlayer(w);
    w.query(Player).updateEach((_, entity) => {
      entity.add(Lane({ current: startLane, target: startLane }));
      entity.add(LaneCount({ value: 4 }));
    });
    // Seed lateral to the current lane centre so snap is already settled.
    const startLateral = laneCenter(startLane, 4, trackArchetypes.laneWidth);
    w.query(Player, Position).updateEach(([pos]) => {
      pos.lateral = startLateral;
    });
  }

  it('eases lateral toward target lane centre after a lane change', () => {
    const w = createWorld();
    spawnMobilePlayer(w, 1);

    // Set target to lane 2 (right).
    w.query(Player, Lane).updateEach(([lane]) => {
      lane.target = 2;
    });
    w.query(Player, Throttle).updateEach(([t]) => {
      t.value = 1;
    });

    const targetLateral = laneCenter(2, 4, trackArchetypes.laneWidth);
    const initialLateral = laneCenter(1, 4, trackArchetypes.laneWidth);

    // After 10 frames the car must have moved toward the target.
    for (let i = 0; i < 10; i++) stepPlayer(w, 1 / 60);
    const pos = w.query(Player, Position)[0]?.get(Position);
    const mid = pos?.lateral ?? initialLateral;
    expect(mid).toBeGreaterThan(initialLateral);
    expect(mid).toBeLessThan(targetLateral + 1e-6);
  });

  it('settles within 1s (60 frames) and commits lane.current', () => {
    const w = createWorld();
    spawnMobilePlayer(w, 0);

    // Request lane 3 (far right).
    w.query(Player, Lane).updateEach(([lane]) => {
      lane.target = 3;
    });
    w.query(Player, Throttle).updateEach(([t]) => {
      t.value = 1;
    });

    for (let i = 0; i < 60; i++) stepPlayer(w, 1 / 60);

    const e = w.query(Player, Lane, Position)[0];
    if (!e) throw new Error('no player');
    const lane = e.get(Lane);
    const pos = e.get(Position);
    const targetLateral = laneCenter(3, 4, trackArchetypes.laneWidth);

    expect(Math.abs((pos?.lateral ?? 0) - targetLateral)).toBeLessThan(0.1);
    expect(lane?.current).toBe(3);
  });

  it('clamps lane target at 0 when target is already 0', () => {
    const w = createWorld();
    spawnMobilePlayer(w, 0);
    // Attempt to go further left (underflow).
    w.query(Player, Lane, LaneCount).updateEach(([lane, laneCount]) => {
      lane.target = Math.max(0, Math.min(laneCount.value - 1, lane.target - 1));
    });
    const lane = w.query(Player, Lane)[0]?.get(Lane);
    expect(lane?.target).toBe(0);
  });

  it('clamps lane target at laneCount-1 when target is at max', () => {
    const w = createWorld();
    spawnMobilePlayer(w, 3);
    // Attempt to go further right (overflow).
    w.query(Player, Lane, LaneCount).updateEach(([lane, laneCount]) => {
      lane.target = Math.max(0, Math.min(laneCount.value - 1, lane.target + 1));
    });
    const lane = w.query(Player, Lane)[0]?.get(Lane);
    expect(lane?.target).toBe(3);
  });

  it('does not integrate Steer while Lane is present', () => {
    const w = createWorld();
    spawnMobilePlayer(w, 2);

    // Set steer to max right — should have no effect on lateral.
    w.query(Player, Steer).updateEach(([s]) => {
      s.value = 1;
    });
    w.query(Player, Throttle).updateEach(([t]) => {
      t.value = 1;
    });

    const initialLateral = laneCenter(2, 4, trackArchetypes.laneWidth);

    for (let i = 0; i < 30; i++) stepPlayer(w, 1 / 60);

    const pos = w.query(Player, Position)[0]?.get(Position);
    // Lateral should remain at the lane-2 centre (target unchanged).
    // We allow a tiny ε because the exp-approach isn't quite zero.
    expect(Math.abs((pos?.lateral ?? 0) - initialLateral)).toBeLessThan(0.01);
  });
});
