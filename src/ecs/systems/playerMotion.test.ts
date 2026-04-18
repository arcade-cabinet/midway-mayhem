/**
 * Unit tests for the player motion integrator.
 *
 * stepPlayer is gated by RunSession presence: when a run is active, the
 * ported gameStateTick owns motion. In these tests we never add RunSession,
 * so stepPlayer drives Position/Speed directly.
 */
import { createWorld } from 'koota';
import { describe, expect, it } from 'vitest';
import { trackArchetypes, tunables } from '@/config';
import { Player, Position, Speed, Steer, Throttle } from '@/ecs/traits';
import { spawnPlayer, stepPlayer } from './playerMotion';

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
