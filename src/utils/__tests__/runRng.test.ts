import { describe, expect, it } from 'vitest';
import { createRunRng } from '@/utils/rng';

describe('createRunRng — dual-channel deterministic PRNG', () => {
  it('same master seed produces identical track + events channels', () => {
    const a = createRunRng(12345);
    const b = createRunRng(12345);
    const trackA = Array.from({ length: 10 }, () => a.track.next());
    const trackB = Array.from({ length: 10 }, () => b.track.next());
    const eventsA = Array.from({ length: 10 }, () => a.events.next());
    const eventsB = Array.from({ length: 10 }, () => b.events.next());
    expect(trackA).toEqual(trackB);
    expect(eventsA).toEqual(eventsB);
  });

  it('track and events channels produce different sequences from same seed', () => {
    const rng = createRunRng(42);
    const t = Array.from({ length: 10 }, () => rng.track.next());
    const e = Array.from({ length: 10 }, () => rng.events.next());
    expect(t).not.toEqual(e);
  });

  it('advancing the events channel does NOT perturb the track channel', () => {
    const a = createRunRng(7);
    const trackBaseline = Array.from({ length: 5 }, () => a.track.next());

    const b = createRunRng(7);
    // Burn a lot of events-channel entropy
    for (let i = 0; i < 1000; i++) b.events.next();
    const trackAfterBurn = Array.from({ length: 5 }, () => b.track.next());

    expect(trackBaseline).toEqual(trackAfterBurn);
  });

  it('different master seeds produce different channels', () => {
    const a = createRunRng(100);
    const b = createRunRng(101);
    expect(a.track.next()).not.toBe(b.track.next());
    expect(a.events.next()).not.toBe(b.events.next());
  });

  it('rng outputs are in [0, 1)', () => {
    const rng = createRunRng(999);
    for (let i = 0; i < 50; i++) {
      const v = rng.track.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
