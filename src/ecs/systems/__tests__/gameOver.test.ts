/**
 * gameOver unit tests — end-of-run detection via damage threshold or
 * distance past the last track segment.
 */
import { createWorld } from 'koota';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trackArchetypes } from '@/config';
import { resetGameOver, stepGameOver } from '@/ecs/systems/gameOver';
import { Player, Position, Score } from '@/ecs/traits';

const LAST_DISTANCE = trackArchetypes.runLength * 28;

function makeWorld(damage = 0, distance = 0) {
  const w = createWorld();
  w.spawn(Player, Position({ distance, lateral: 0 }), Score({ damage }));
  return w;
}

describe('stepGameOver', () => {
  beforeEach(() => {
    resetGameOver();
  });

  it('does nothing when no player entity exists', () => {
    const w = createWorld();
    const onEnd = vi.fn();
    stepGameOver(w, { onEnd });
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('does not fire when damage < 3 and distance within bounds', () => {
    const w = makeWorld(2, 100);
    const onEnd = vi.fn();
    stepGameOver(w, { onEnd });
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('fires "damage" when damage reaches 3', () => {
    const w = makeWorld(3, 100);
    const onEnd = vi.fn();
    stepGameOver(w, { onEnd });
    expect(onEnd).toHaveBeenCalledWith('damage');
  });

  it('fires "damage" on damage > 3', () => {
    const w = makeWorld(5, 100);
    const onEnd = vi.fn();
    stepGameOver(w, { onEnd });
    expect(onEnd).toHaveBeenCalledWith('damage');
  });

  it('fires "finish" when player distance exceeds lastDistance', () => {
    const w = makeWorld(0, LAST_DISTANCE + 10);
    const onEnd = vi.fn();
    stepGameOver(w, { onEnd });
    expect(onEnd).toHaveBeenCalledWith('finish');
  });

  it('does not fire again after first end (one-shot semantics)', () => {
    const w = makeWorld(3, 0);
    const onEnd = vi.fn();
    stepGameOver(w, { onEnd });
    stepGameOver(w, { onEnd });
    stepGameOver(w, { onEnd });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('damage wins over finish when both conditions are met on the same frame', () => {
    const w = makeWorld(3, LAST_DISTANCE + 10);
    const onEnd = vi.fn();
    stepGameOver(w, { onEnd });
    expect(onEnd).toHaveBeenCalledWith('damage');
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('resetGameOver allows another end event to fire', () => {
    const w = makeWorld(3, 0);
    const onEnd = vi.fn();
    stepGameOver(w, { onEnd });
    resetGameOver();
    stepGameOver(w, { onEnd });
    expect(onEnd).toHaveBeenCalledTimes(2);
  });

  it('no callback is fine (no-op when cb.onEnd is undefined)', () => {
    const w = makeWorld(3, 0);
    expect(() => stepGameOver(w, {})).not.toThrow();
  });

  it('is a no-op while distance is exactly at lastDistance (strict >)', () => {
    const w = makeWorld(0, LAST_DISTANCE);
    const onEnd = vi.fn();
    stepGameOver(w, { onEnd });
    expect(onEnd).not.toHaveBeenCalled();
  });
});
