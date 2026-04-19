/**
 * ecs/world unit tests — module-level koota world singleton invariants.
 */
import { describe, expect, it } from 'vitest';
import { Player } from '@/ecs/traits';
import { world } from '@/ecs/world';

describe('world', () => {
  it('is a valid koota World instance', () => {
    expect(typeof world.spawn).toBe('function');
    expect(typeof world.query).toBe('function');
    expect(typeof world.destroy).toBe('function');
  });

  it('is the same reference across imports (module singleton)', async () => {
    const mod = await import('@/ecs/world');
    expect(mod.world).toBe(world);
  });

  it('supports spawn + query round-trips', () => {
    const before = world.query(Player).length;
    const e = world.spawn(Player);
    const after = world.query(Player).length;
    expect(after).toBe(before + 1);
    e.destroy();
    expect(world.query(Player).length).toBe(before);
  });
});
