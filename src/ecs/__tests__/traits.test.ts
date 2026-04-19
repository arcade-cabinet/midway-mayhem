/**
 * traits unit tests — trait defaults + schema invariants. Spawns an
 * entity with each trait at defaults and confirms the returned snapshot
 * matches the documented schema.
 */
import { createWorld } from 'koota';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BoostState,
  DropIntro,
  GameplayStats,
  LaneCount,
  Obstacle,
  PhotoMode,
  Pickup,
  PlungeState,
  Position,
  RunCounters,
  RunSession,
  Score,
  Speed,
  Steer,
  Throttle,
  TrackSegment,
  TrickState,
  Zone,
} from '@/ecs/traits';

const _worlds: ReturnType<typeof createWorld>[] = [];
function freshWorld() {
  const w = createWorld();
  _worlds.push(w);
  return w;
}

afterEach(() => {
  while (_worlds.length) _worlds.pop()?.destroy();
});

describe('Position defaults', () => {
  it('distance=0, lateral=0', () => {
    const w = freshWorld();
    const e = w.spawn(Position);
    expect(e.get(Position)).toEqual({ distance: 0, lateral: 0 });
  });

  it('accepts overrides', () => {
    const w = freshWorld();
    const e = w.spawn(Position({ distance: 500, lateral: 2.5 }));
    expect(e.get(Position)?.distance).toBe(500);
    expect(e.get(Position)?.lateral).toBe(2.5);
  });
});

describe('Speed defaults', () => {
  it('value=0, target=0', () => {
    const w = freshWorld();
    const e = w.spawn(Speed);
    expect(e.get(Speed)).toEqual({ value: 0, target: 0 });
  });
});

describe('Steer + Throttle defaults', () => {
  it('Steer.value = 0', () => {
    const w = freshWorld();
    const e = w.spawn(Steer);
    expect(e.get(Steer)?.value).toBe(0);
  });

  it('Throttle.value = 1 (auto-accelerate default)', () => {
    const w = freshWorld();
    const e = w.spawn(Throttle);
    expect(e.get(Throttle)?.value).toBe(1);
  });
});

describe('Score defaults', () => {
  it('all fields start at zero', () => {
    const w = freshWorld();
    const e = w.spawn(Score);
    expect(e.get(Score)).toEqual({
      value: 0,
      balloons: 0,
      boostRemaining: 0,
      damage: 0,
      cleanSeconds: 0,
    });
  });
});

describe('Obstacle defaults', () => {
  it('kind=cone, distance=0, not-consumed, not-fleeing', () => {
    const w = freshWorld();
    const e = w.spawn(Obstacle);
    const o = e.get(Obstacle);
    expect(o?.kind).toBe('cone');
    expect(o?.distance).toBe(0);
    expect(o?.lateral).toBe(0);
    expect(o?.consumed).toBe(false);
    expect(o?.critterKind).toBe('');
    expect(o?.fleeStartedAt).toBe(0);
    expect(o?.fleeDir).toBe(0);
    expect(o?.swingPhase).toBe(0);
  });
});

describe('Pickup defaults', () => {
  it('kind=balloon, not-consumed', () => {
    const w = freshWorld();
    const e = w.spawn(Pickup);
    const p = e.get(Pickup);
    expect(p?.kind).toBe('balloon');
    expect(p?.consumed).toBe(false);
  });
});

describe('Zone defaults', () => {
  it('theme=carnival, distance=0', () => {
    const w = freshWorld();
    const e = w.spawn(Zone);
    expect(e.get(Zone)).toEqual({ theme: 'carnival', distance: 0 });
  });
});

describe('LaneCount defaults', () => {
  it('value=4', () => {
    const w = freshWorld();
    const e = w.spawn(LaneCount);
    expect(e.get(LaneCount)?.value).toBe(4);
  });
});

describe('TrackSegment defaults', () => {
  it('archetype=straight, index=0, all deltas=0', () => {
    const w = freshWorld();
    const e = w.spawn(TrackSegment);
    const s = e.get(TrackSegment);
    expect(s?.archetype).toBe('straight');
    expect(s?.index).toBe(0);
    expect(s?.deltaYaw).toBe(0);
    expect(s?.deltaPitch).toBe(0);
    expect(s?.bank).toBe(0);
  });
});

describe('RunSession defaults', () => {
  it('not-running, not-paused, not-gameOver', () => {
    const w = freshWorld();
    const e = w.spawn(RunSession);
    const rs = e.get(RunSession);
    expect(rs?.running).toBe(false);
    expect(rs?.paused).toBe(false);
    expect(rs?.gameOver).toBe(false);
    expect(rs?.startedAt).toBe(0);
    expect(rs?.seed).toBe(0);
    expect(rs?.difficulty).toBe('kazoo');
    expect(rs?.seedPhrase).toBe('');
    expect(rs?.permadeath).toBe(false);
  });
});

describe('GameplayStats defaults', () => {
  it('sanity=100, cleanliness=1, throttle=1; rest=0 or midway-strip zone', () => {
    const w = freshWorld();
    const e = w.spawn(GameplayStats);
    const g = e.get(GameplayStats);
    expect(g?.sanity).toBe(100);
    expect(g?.cleanliness).toBe(1);
    expect(g?.throttle).toBe(1);
    expect(g?.distance).toBe(0);
    expect(g?.crashes).toBe(0);
    expect(g?.currentZone).toBe('midway-strip');
  });
});

describe('BoostState / DropIntro / PlungeState / TrickState / RunCounters / PhotoMode', () => {
  it('BoostState starts at zero expiries', () => {
    const w = freshWorld();
    const e = w.spawn(BoostState);
    expect(e.get(BoostState)).toEqual({ boostUntil: 0, megaBoostUntil: 0 });
  });

  it('DropIntro starts at zero progress', () => {
    const w = freshWorld();
    const e = w.spawn(DropIntro);
    expect(e.get(DropIntro)).toEqual({ dropProgress: 0, dropStartedAt: 0 });
  });

  it('PlungeState starts not-plunging', () => {
    const w = freshWorld();
    const e = w.spawn(PlungeState);
    const p = e.get(PlungeState);
    expect(p?.plunging).toBe(false);
    expect(p?.plungeStartedAt).toBe(0);
    expect(p?.plungeDirection).toBe(0);
    expect(p?.currentPieceKind).toBeNull();
  });

  it('TrickState starts not-airborne, no active trick', () => {
    const w = freshWorld();
    const e = w.spawn(TrickState);
    expect(e.get(TrickState)).toEqual({
      airborne: false,
      trickActive: false,
      trickRotationY: 0,
      trickRotationZ: 0,
    });
  });

  it('RunCounters start at 0', () => {
    const w = freshWorld();
    const e = w.spawn(RunCounters);
    expect(e.get(RunCounters)).toEqual({
      scaresThisRun: 0,
      maxComboThisRun: 0,
      raidsSurvived: 0,
      ticketsThisRun: 0,
    });
  });

  it('PhotoMode starts inactive', () => {
    const w = freshWorld();
    const e = w.spawn(PhotoMode);
    expect(e.get(PhotoMode)?.active).toBe(false);
  });
});
