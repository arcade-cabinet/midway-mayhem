/**
 * scores unit tests — web localStorage fallback path (Node, no Capacitor
 * native). Covers save ordering, MAX_ROWS cap, loadTopScores limit,
 * corrupt-JSON recovery, and the silent no-op when localStorage is absent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTopScores, type ScoreRow, saveScore } from '@/storage/scores';

// Mock @capacitor/core so hasNativeSqlite() resolves false (web path).
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

const LS_KEY = 'mm.scores.v1';
const ORIG_STORAGE = globalThis.localStorage;

function installLocalStorage() {
  const store = new Map<string, string>();
  const ls = {
    getItem(k: string) {
      return store.has(k) ? (store.get(k) as string) : null;
    },
    setItem(k: string, v: string) {
      store.set(k, v);
    },
    removeItem(k: string) {
      store.delete(k);
    },
    clear() {
      store.clear();
    },
    key: () => null,
    length: 0,
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: ls,
  });
  return store;
}

function uninstallLocalStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: ORIG_STORAGE,
  });
}

function row(score: number, balloons = 0): ScoreRow {
  return { score, balloons, seed: 1, timestamp: Date.now() };
}

describe('scores (web fallback)', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    uninstallLocalStorage();
  });

  it('loadTopScores returns [] when the store is empty', async () => {
    expect(await loadTopScores()).toEqual([]);
  });

  it('saveScore persists a single row and loadTopScores returns it', async () => {
    await saveScore(row(100));
    const top = await loadTopScores();
    expect(top).toHaveLength(1);
    expect(top[0]?.score).toBe(100);
  });

  it('loadTopScores defaults to a limit of 5', async () => {
    for (let i = 1; i <= 10; i++) await saveScore(row(i * 10));
    const top = await loadTopScores();
    expect(top).toHaveLength(5);
  });

  it('loadTopScores respects a custom limit', async () => {
    for (let i = 1; i <= 10; i++) await saveScore(row(i * 10));
    expect(await loadTopScores(3)).toHaveLength(3);
    expect(await loadTopScores(10)).toHaveLength(10);
  });

  it('scores are sorted descending in the stored list (best first)', async () => {
    await saveScore(row(50));
    await saveScore(row(200));
    await saveScore(row(100));
    const top = await loadTopScores();
    expect(top.map((r) => r.score)).toEqual([200, 100, 50]);
  });

  it('caps stored rows at MAX_ROWS=25', async () => {
    for (let i = 0; i < 40; i++) await saveScore(row(i));
    // Internal store should be at most 25 entries; loadTopScores(100) caps there.
    const top = await loadTopScores(100);
    expect(top.length).toBeLessThanOrEqual(25);
  });

  it('keeps the HIGHEST scores when capping', async () => {
    for (let i = 0; i < 40; i++) await saveScore(row(i));
    const top = await loadTopScores(100);
    // All retained scores should be in the upper half of [0..39]: ≥ 40-25 = 15.
    for (const r of top) expect(r.score).toBeGreaterThanOrEqual(15);
  });

  it('recovers from corrupt JSON in localStorage', async () => {
    localStorage.setItem(LS_KEY, '{not-json');
    // Both paths should degrade to empty rather than throwing.
    await expect(loadTopScores()).resolves.toEqual([]);
    await expect(saveScore(row(42))).resolves.toBeUndefined();
    const top = await loadTopScores();
    expect(top).toHaveLength(1);
    expect(top[0]?.score).toBe(42);
  });

  it('recovers when localStorage value is not an array', async () => {
    localStorage.setItem(LS_KEY, '{"unexpected":"object"}');
    expect(await loadTopScores()).toEqual([]);
  });
});

describe('scores (no localStorage)', () => {
  beforeEach(() => {
    uninstallLocalStorage();
  });

  it('loadTopScores returns [] when localStorage is undefined', async () => {
    expect(await loadTopScores()).toEqual([]);
  });

  it('saveScore is a silent no-op when localStorage is undefined', async () => {
    await expect(saveScore(row(99))).resolves.toBeUndefined();
  });
});
