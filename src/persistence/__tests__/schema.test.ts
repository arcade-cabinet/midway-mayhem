/**
 * persistence/schema unit tests — Drizzle table definition structural
 * invariants. Guards against accidental column renames / drops.
 */
import { describe, expect, it } from 'vitest';
import {
  achievements,
  dailyRuns,
  lifetimeStats,
  loadout,
  profile,
  replays,
  unlocks,
} from '@/persistence/schema';

function cols(table: unknown): Set<string> {
  const t = table as Record<string, unknown>;
  return new Set(Object.keys(t).filter((k) => !k.startsWith('_') && k !== 'getSQL'));
}

describe('profile table', () => {
  it('exposes the required columns', () => {
    const c = cols(profile);
    for (const col of [
      'id',
      'tickets',
      'totalRuns',
      'bestDistanceCm',
      'bestCrowd',
      'createdAt',
      'updatedAt',
    ]) {
      expect(c.has(col)).toBe(true);
    }
  });
});

describe('unlocks table', () => {
  it('exposes id / kind / slug / unlockedAt', () => {
    const c = cols(unlocks);
    for (const col of ['id', 'kind', 'slug', 'unlockedAt']) expect(c.has(col)).toBe(true);
  });
});

describe('loadout table', () => {
  it('has one slug column per equippable slot', () => {
    const c = cols(loadout);
    for (const col of ['id', 'palette', 'ornament', 'horn', 'rim', 'dice', 'hornShape']) {
      expect(c.has(col)).toBe(true);
    }
  });
});

describe('dailyRuns table', () => {
  it('has date-primary key + seed + best columns', () => {
    const c = cols(dailyRuns);
    for (const col of ['dateUtc', 'seed', 'bestDistanceCm', 'bestCrowd', 'runCount']) {
      expect(c.has(col)).toBe(true);
    }
  });
});

describe('replays table', () => {
  it('has id + dailyDate + distance + crowd + inputTraceJson + createdAt', () => {
    const c = cols(replays);
    for (const col of ['id', 'dailyDate', 'distanceCm', 'crowd', 'inputTraceJson', 'createdAt']) {
      expect(c.has(col)).toBe(true);
    }
  });
});

describe('achievements table', () => {
  it('has slug + unlockedAt + progressValue + targetValue', () => {
    const c = cols(achievements);
    for (const col of ['id', 'slug', 'unlockedAt', 'progressValue', 'targetValue']) {
      expect(c.has(col)).toBe(true);
    }
  });
});

describe('lifetimeStats table', () => {
  it('has the full lifetime counter set', () => {
    const c = cols(lifetimeStats);
    for (const col of [
      'id',
      'totalDistanceCm',
      'totalCrashes',
      'totalScares',
      'totalTicketsEarned',
      'totalRunsCompleted',
      'totalGameOversByPlunge',
      'totalGameOversBySanity',
      'longestComboChain',
      'maxSingleRunCrowd',
      'bestZoneTimeMs',
      'secondsPlayed',
    ]) {
      expect(c.has(col)).toBe(true);
    }
  });
});
