import { describe, expect, it, beforeEach } from 'vitest';
import { trickInputBus } from '@/game/trickInputBus';

describe('trickInputBus', () => {
  beforeEach(() => {
    trickInputBus.clear();
  });

  it('drain returns empty array when nothing pushed', () => {
    expect(trickInputBus.drain()).toEqual([]);
  });

  it('drain returns all pushed inputs and clears the queue', () => {
    trickInputBus.push('left');
    trickInputBus.push('left');
    const result = trickInputBus.drain();
    expect(result).toEqual(['left', 'left']);
    // Second drain should be empty
    expect(trickInputBus.drain()).toEqual([]);
  });

  it('drain returns inputs in push order', () => {
    trickInputBus.push('right');
    trickInputBus.push('up');
    trickInputBus.push('down');
    expect(trickInputBus.drain()).toEqual(['right', 'up', 'down']);
  });

  it('clear removes queued inputs without returning them', () => {
    trickInputBus.push('left');
    trickInputBus.clear();
    expect(trickInputBus.drain()).toEqual([]);
  });

  it('can accept all TrickInput directions', () => {
    trickInputBus.push('left');
    trickInputBus.push('right');
    trickInputBus.push('up');
    trickInputBus.push('down');
    const result = trickInputBus.drain();
    expect(result).toHaveLength(4);
    expect(result).toContain('left');
    expect(result).toContain('right');
    expect(result).toContain('up');
    expect(result).toContain('down');
  });
});
