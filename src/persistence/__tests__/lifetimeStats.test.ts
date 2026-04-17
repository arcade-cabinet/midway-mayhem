import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initDb, resetDbForTests } from '../db';
import { getStats, recordRun, resetStats } from '../lifetimeStats';
import type { RunSummary } from '../lifetimeStats';

const BASE_RUN: RunSummary = {
  distanceM: 100,
  crashes: 2,
  scares: 3,
  ticketsEarned: 5,
  crowd: 150,
  maxComboChain: 4,
  plunged: false,
  secondsPlayed: 45,
};

beforeEach(async () => {
  await resetDbForTests();
  await initDb();
});

afterEach(async () => {
  await resetDbForTests();
});

describe('getStats — initial state', () => {
  it('returns zero counters on fresh DB', async () => {
    const stats = await getStats();
    expect(stats.totalDistanceCm).toBe(0);
    expect(stats.totalCrashes).toBe(0);
    expect(stats.totalRunsCompleted).toBe(0);
    expect(stats.secondsPlayed).toBe(0);
    expect(stats.bestZoneTimeMs).toEqual({});
  });
});

describe('recordRun — single run', () => {
  it('increments total_runs_completed by 1', async () => {
    await recordRun(BASE_RUN);
    const stats = await getStats();
    expect(stats.totalRunsCompleted).toBe(1);
  });

  it('converts distance metres to cm', async () => {
    await recordRun({ ...BASE_RUN, distanceM: 500 });
    const stats = await getStats();
    expect(stats.totalDistanceCm).toBe(50000);
  });

  it('accumulates crashes', async () => {
    await recordRun({ ...BASE_RUN, crashes: 3 });
    const stats = await getStats();
    expect(stats.totalCrashes).toBe(3);
  });

  it('accumulates scares', async () => {
    await recordRun({ ...BASE_RUN, scares: 7 });
    const stats = await getStats();
    expect(stats.totalScares).toBe(7);
  });

  it('tracks totalGameOversByPlunge', async () => {
    await recordRun({ ...BASE_RUN, plunged: true });
    const stats = await getStats();
    expect(stats.totalGameOversByPlunge).toBe(1);
    expect(stats.totalGameOversBySanity).toBe(0);
  });

  it('tracks totalGameOversBySanity', async () => {
    await recordRun({ ...BASE_RUN, plunged: false });
    const stats = await getStats();
    expect(stats.totalGameOversBySanity).toBe(1);
    expect(stats.totalGameOversByPlunge).toBe(0);
  });
});

describe('recordRun — 3 runs, aggregates correct', () => {
  it('accumulates all counters across 3 runs', async () => {
    await recordRun({ ...BASE_RUN, distanceM: 100, crashes: 1, scares: 2, ticketsEarned: 3, crowd: 100, maxComboChain: 5, plunged: false, secondsPlayed: 30 });
    await recordRun({ ...BASE_RUN, distanceM: 200, crashes: 3, scares: 5, ticketsEarned: 1, crowd: 300, maxComboChain: 10, plunged: true,  secondsPlayed: 60 });
    await recordRun({ ...BASE_RUN, distanceM: 150, crashes: 0, scares: 1, ticketsEarned: 2, crowd: 200, maxComboChain: 7,  plunged: false, secondsPlayed: 45 });

    const stats = await getStats();

    expect(stats.totalRunsCompleted).toBe(3);
    expect(stats.totalDistanceCm).toBe(100 * 100 + 200 * 100 + 150 * 100); // 45000
    expect(stats.totalCrashes).toBe(4);
    expect(stats.totalScares).toBe(8);
    expect(stats.totalTicketsEarned).toBe(6);
    expect(stats.totalGameOversByPlunge).toBe(1);
    expect(stats.totalGameOversBySanity).toBe(2);
    expect(stats.longestComboChain).toBe(10);
    expect(stats.maxSingleRunCrowd).toBe(300);
    expect(stats.secondsPlayed).toBe(135);
  });
});

describe('recordRun — personal bests', () => {
  it('longestComboChain tracks the max across runs', async () => {
    await recordRun({ ...BASE_RUN, maxComboChain: 5 });
    await recordRun({ ...BASE_RUN, maxComboChain: 20 });
    await recordRun({ ...BASE_RUN, maxComboChain: 8 });
    const stats = await getStats();
    expect(stats.longestComboChain).toBe(20);
  });

  it('maxSingleRunCrowd tracks the max across runs', async () => {
    await recordRun({ ...BASE_RUN, crowd: 100 });
    await recordRun({ ...BASE_RUN, crowd: 500 });
    await recordRun({ ...BASE_RUN, crowd: 200 });
    const stats = await getStats();
    expect(stats.maxSingleRunCrowd).toBe(500);
  });
});

describe('recordRun — zone time bests', () => {
  it('stores per-zone best times', async () => {
    await recordRun({
      ...BASE_RUN,
      zoneTimesMs: { 'midway-strip': 12000, 'balloon-alley': 8500 },
    });
    const stats = await getStats();
    expect(stats.bestZoneTimeMs['midway-strip']).toBe(12000);
    expect(stats.bestZoneTimeMs['balloon-alley']).toBe(8500);
  });

  it('keeps the LOWEST (best) time per zone', async () => {
    await recordRun({ ...BASE_RUN, zoneTimesMs: { 'midway-strip': 15000 } });
    await recordRun({ ...BASE_RUN, zoneTimesMs: { 'midway-strip': 9000 } });
    await recordRun({ ...BASE_RUN, zoneTimesMs: { 'midway-strip': 12000 } });
    const stats = await getStats();
    expect(stats.bestZoneTimeMs['midway-strip']).toBe(9000);
  });
});

describe('resetStats — debug only', () => {
  it('zeroes all counters', async () => {
    await recordRun(BASE_RUN);
    await resetStats();
    const stats = await getStats();
    expect(stats.totalRunsCompleted).toBe(0);
    expect(stats.totalDistanceCm).toBe(0);
    expect(stats.longestComboChain).toBe(0);
    expect(stats.bestZoneTimeMs).toEqual({});
  });
});
