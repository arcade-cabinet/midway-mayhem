import { describe, expect, it } from 'vitest';
import { createRng, dailySeed } from '../rng';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const firstA = a.next();
    const firstB = b.next();
    expect(firstA).not.toBe(firstB);
  });

  it('range respects bounds', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.range(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  it('int returns integers in bounds', () => {
    const r = createRng(11);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(0, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });

  it('pick returns a valid element', () => {
    const r = createRng(13);
    const items = ['a', 'b', 'c', 'd'];
    const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    for (let i = 0; i < 4000; i++) {
      const pick = r.pick(items);
      expect(items).toContain(pick);
      counts[pick]! += 1;
    }
    // Roughly uniform
    for (const c of Object.values(counts)) {
      expect(c).toBeGreaterThan(500);
      expect(c).toBeLessThan(1500);
    }
  });

  it('pick throws on empty array', () => {
    const r = createRng(1);
    expect(() => r.pick([])).toThrow(/empty/);
  });

  it('dailySeed is stable per UTC date', () => {
    const d = new Date(Date.UTC(2026, 3, 16));
    expect(dailySeed(d)).toBe(20260416);
  });

  it('reseed resets sequence', () => {
    const r = createRng(1);
    r.next();
    r.next();
    r.reseed(1);
    const fresh = createRng(1);
    expect(r.next()).toBe(fresh.next());
  });
});
