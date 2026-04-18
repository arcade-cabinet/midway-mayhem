import { beforeEach, describe, expect, it } from 'vitest';
import { MirrorDuplicator } from '@/game/obstacles/mirrorDuplicator';
import { createRng } from '@/utils/rng';

describe('MirrorDuplicator', () => {
  let dup: MirrorDuplicator;

  beforeEach(() => {
    dup = new MirrorDuplicator(createRng(99));
  });

  it('starts with no entries', () => {
    expect(dup.getEntries()).toHaveLength(0);
  });

  it('does not create entries outside funhouse-frenzy zone', () => {
    const obstacles = [{ id: 1, lane: 0, d: 100 }];
    dup.sync(obstacles, 'midway-strip');
    expect(dup.getEntries()).toHaveLength(0);
    dup.sync(obstacles, 'balloon-alley');
    expect(dup.getEntries()).toHaveLength(0);
    dup.sync(obstacles, 'ring-of-fire');
    expect(dup.getEntries()).toHaveLength(0);
  });

  it('creates entries for obstacles in funhouse-frenzy', () => {
    const obstacles = [
      { id: 1, lane: 0, d: 100 },
      { id: 2, lane: 2, d: 120 },
    ];
    dup.sync(obstacles, 'funhouse-frenzy');
    expect(dup.getEntries().length).toBe(2);
  });

  it('each entry has 1 or 2 mirror copies', () => {
    const obstacles = [{ id: 1, lane: 1, d: 100 }];
    dup.sync(obstacles, 'funhouse-frenzy');
    const entry = dup.getEntries()[0]!;
    expect(entry.copies.length).toBeGreaterThanOrEqual(1);
    expect(entry.copies.length).toBeLessThanOrEqual(2);
  });

  it('mirror copies are in different lanes than real obstacle', () => {
    // Run many obstacles to verify invariant
    const obstacles = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      lane: 1, // all in middle lane
      d: 100 + i * 20,
    }));
    dup.sync(obstacles, 'funhouse-frenzy');
    for (const entry of dup.getEntries()) {
      for (const copy of entry.copies) {
        expect(copy.lane).not.toBe(entry.realLane);
      }
    }
  });

  it('copyOpacity flickers between ~0 and ~0.85 on a square wave', () => {
    const obstacles = [{ id: 1, lane: 0, d: 100 }];
    dup.sync(obstacles, 'funhouse-frenzy');
    const entry = dup.getEntries()[0]!;
    const copy = entry.copies[0]!;

    // At t=0 with phase=0, the value should be either 0 or 0.85
    const op0 = dup.copyOpacity(copy, copy.flickerPhase);
    expect([0, 0.85]).toContain(op0);

    // After half a period, it should toggle
    const op1 = dup.copyOpacity(copy, copy.flickerPhase + copy.flickerPeriod / 2 + 0.001);
    expect([0, 0.85]).toContain(op1);
    // They should differ
    expect(op0).not.toBe(op1);
  });

  it('flicker period is within 0.1-0.4s range', () => {
    const obstacles = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      lane: i % 3,
      d: 100 + i * 10,
    }));
    dup.sync(obstacles, 'funhouse-frenzy');
    for (const entry of dup.getEntries()) {
      for (const copy of entry.copies) {
        expect(copy.flickerPeriod).toBeGreaterThanOrEqual(0.1);
        expect(copy.flickerPeriod).toBeLessThanOrEqual(0.41);
      }
    }
  });

  it('stale obstacles (not in current list) are removed on sync', () => {
    const obstacles = [{ id: 1, lane: 0, d: 100 }];
    dup.sync(obstacles, 'funhouse-frenzy');
    expect(dup.getEntries().length).toBe(1);

    // Remove obstacle 1
    dup.sync([], 'funhouse-frenzy');
    expect(dup.getEntries().length).toBe(0);
  });

  it('instanceCount returns total copy count across all entries', () => {
    const obstacles = [
      { id: 1, lane: 0, d: 100 },
      { id: 2, lane: 2, d: 120 },
      { id: 3, lane: 1, d: 140 },
    ];
    dup.sync(obstacles, 'funhouse-frenzy');
    const entries = dup.getEntries();
    const expected = entries.reduce((sum, e) => sum + e.copies.length, 0);
    expect(dup.instanceCount).toBe(expected);
  });

  it('clears on zone exit (non-funhouse-frenzy)', () => {
    dup.sync([{ id: 1, lane: 0, d: 100 }], 'funhouse-frenzy');
    expect(dup.getEntries().length).toBe(1);
    dup.sync([{ id: 1, lane: 0, d: 100 }], 'midway-strip');
    expect(dup.getEntries().length).toBe(0);
  });

  it('reset() clears all entries', () => {
    dup.sync([{ id: 1, lane: 0, d: 100 }], 'funhouse-frenzy');
    dup.reset();
    expect(dup.getEntries()).toHaveLength(0);
  });
});
