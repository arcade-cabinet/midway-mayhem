/**
 * Unit tests for the player spawn helper. The motion integrator itself
 * lives in game/gameStateTick now — Position/Speed/Score are driven there
 * so there's a single authoritative source of distance. stepPlayer is kept
 * as a no-op for callers that still import it.
 */
import { createWorld } from 'koota';
import { describe, expect, it } from 'vitest';
import { Player, Position, Speed } from '@/ecs/traits';
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

  it('stepPlayer is a no-op (motion moved to gameStateTick)', () => {
    const w = createWorld();
    spawnPlayer(w);
    stepPlayer(w, 1 / 60);
    const pos = w.query(Player, Position)[0]?.get(Position);
    expect(pos?.distance).toBe(0);
    expect(pos?.lateral).toBe(0);
  });
});
