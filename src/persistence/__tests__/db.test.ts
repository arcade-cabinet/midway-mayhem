/**
 * persistence/db unit tests — init idempotence, db() accessor guard,
 * resetDbForTests teardown. Runs against the in-memory sql.js path
 * (selected via VITEST env).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, initDb, resetDbForTests } from '@/persistence/db';
import { loadout } from '@/persistence/schema';

beforeEach(async () => {
  await resetDbForTests();
});

afterEach(async () => {
  await resetDbForTests();
});

describe('initDb', () => {
  it('initialises the drizzle client', async () => {
    await initDb();
    expect(db()).toBeDefined();
  });

  it('is idempotent — repeated calls reuse the same drizzle instance', async () => {
    await initDb();
    const a = db();
    await initDb();
    const b = db();
    expect(b).toBe(a);
  });

  it('concurrent initDb() calls share the same init promise', async () => {
    const p1 = initDb();
    const p2 = initDb();
    await Promise.all([p1, p2]);
    expect(db()).toBeDefined();
  });

  it('runs migrations so the loadout table is queryable', async () => {
    await initDb();
    const rows = await db().select().from(loadout).all();
    expect(Array.isArray(rows)).toBe(true);
  });

  it('seeds a default loadout row (id=1)', async () => {
    await initDb();
    const rows = await db().select().from(loadout).all();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]?.id).toBe(1);
    expect(rows[0]?.palette).toBe('classic');
  });
});

describe('db()', () => {
  it('throws before initDb()', () => {
    expect(() => db()).toThrow(/not initialized/);
  });
});

describe('resetDbForTests', () => {
  it('allows a subsequent initDb() to produce a fresh client', async () => {
    await initDb();
    const first = db();
    await resetDbForTests();
    expect(() => db()).toThrow();
    await initDb();
    const second = db();
    expect(second).not.toBe(first);
  });

  it('is safe to call when uninitialised', async () => {
    await expect(resetDbForTests()).resolves.toBeUndefined();
  });
});

describe('round-trip: insert + read via loadout', () => {
  it('can update default loadout and read it back', async () => {
    await initDb();
    await db()
      .update(loadout)
      .set({ palette: 'neon' })
      .where((await import('drizzle-orm')).eq(loadout.id, 1))
      .run();
    const rows = await db().select().from(loadout).all();
    expect(rows[0]?.palette).toBe('neon');
  });
});
