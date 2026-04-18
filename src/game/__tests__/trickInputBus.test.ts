import { describe, expect, it } from 'vitest';
import { trickInputBus } from '@/game/trickInputBus';

describe('trickInputBus', () => {
  it('drain() returns empty array when nothing queued', () => {
    // Drain any state left by previous tests
    trickInputBus.drain();
    expect(trickInputBus.drain()).toEqual([]);
  });

  it('drain() returns all queued inputs in order and clears queue', () => {
    trickInputBus.push('left');
    trickInputBus.push('left');
    trickInputBus.push('right');
    const result = trickInputBus.drain();
    expect(result).toEqual(['left', 'left', 'right']);
    // Queue should be empty after drain
    expect(trickInputBus.drain()).toEqual([]);
  });

  it('clear() discards all queued inputs', () => {
    trickInputBus.push('up');
    trickInputBus.push('down');
    trickInputBus.clear();
    expect(trickInputBus.drain()).toEqual([]);
  });

  it('accepts all four TrickInput directions', () => {
    trickInputBus.push('left');
    trickInputBus.push('right');
    trickInputBus.push('up');
    trickInputBus.push('down');
    const result = trickInputBus.drain();
    expect(result).toEqual(['left', 'right', 'up', 'down']);
  });
});
