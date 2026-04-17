import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initDb, resetDbForTests } from '../db';
import { type ReplaySample, getBestReplayForDate, listReplaysForDate, replaysEqual, saveReplay } from '../replay';

const TODAY = '2026-04-16';
const TRACE: ReplaySample[] = [
  { t: 0.0, lateral: 0, speedMps: 30, steer: 0 },
  { t: 0.033, lateral: 0.5, speedMps: 32, steer: 0.3 },
  { t: 0.066, lateral: 1.0, speedMps: 34, steer: 0.5 },
];

beforeEach(async () => {
  await resetDbForTests();
  await initDb();
});

afterEach(async () => {
  await resetDbForTests();
});

describe('replay — save + list', () => {
  it('saves and retrieves a replay', async () => {
    await saveReplay(TODAY, 500, 200, TRACE);
    const list = await listReplaysForDate(TODAY);
    expect(list.length).toBe(1);
    expect(list[0]!.distanceCm).toBe(50000);
    expect(list[0]!.crowd).toBe(200);
    expect(list[0]!.trace).toHaveLength(3);
    expect(list[0]!.trace[1]!.steer).toBeCloseTo(0.3);
  });

  it('lists multiple replays ordered by newest first', async () => {
    await saveReplay(TODAY, 100, 10, TRACE);
    await saveReplay(TODAY, 300, 50, TRACE);
    const list = await listReplaysForDate(TODAY);
    expect(list.length).toBe(2);
    // Newest (distanceCm=300m) first
    expect(list[0]!.distanceCm).toBe(30000);
  });

  it('returns empty list for date with no replays', async () => {
    const list = await listReplaysForDate('1900-01-01');
    expect(list).toHaveLength(0);
  });

  it('enforces max 20 replays per date', async () => {
    for (let i = 0; i < 25; i++) {
      await saveReplay(TODAY, i * 10, i, TRACE);
    }
    const list = await listReplaysForDate(TODAY);
    expect(list.length).toBeLessThanOrEqual(20);
  });
});

describe('replay — best replay', () => {
  it('returns null when no replays exist', async () => {
    const best = await getBestReplayForDate(TODAY);
    expect(best).toBeNull();
  });

  it('returns the replay with highest distanceCm', async () => {
    await saveReplay(TODAY, 100, 5, TRACE);
    await saveReplay(TODAY, 500, 5, TRACE);
    await saveReplay(TODAY, 200, 5, TRACE);
    const best = await getBestReplayForDate(TODAY);
    expect(best?.distanceCm).toBe(50000);
  });

  it('breaks ties by crowd score', async () => {
    await saveReplay(TODAY, 500, 100, TRACE);
    await saveReplay(TODAY, 500, 999, TRACE);
    const best = await getBestReplayForDate(TODAY);
    expect(best?.crowd).toBe(999);
  });
});

describe('replaysEqual', () => {
  it('two nulls are equal', () => {
    expect(replaysEqual(null, null)).toBe(true);
  });

  it('null vs row is not equal', async () => {
    await saveReplay(TODAY, 100, 10, TRACE);
    const [row] = await listReplaysForDate(TODAY);
    expect(replaysEqual(null, row ?? null)).toBe(false);
  });

  it('same id is equal', async () => {
    await saveReplay(TODAY, 100, 10, TRACE);
    const [row] = await listReplaysForDate(TODAY);
    expect(replaysEqual(row ?? null, row ?? null)).toBe(true);
  });

  it('different ids are not equal', async () => {
    await saveReplay(TODAY, 100, 10, TRACE);
    await saveReplay(TODAY, 200, 20, TRACE);
    const list = await listReplaysForDate(TODAY);
    expect(replaysEqual(list[0] ?? null, list[1] ?? null)).toBe(false);
  });
});
