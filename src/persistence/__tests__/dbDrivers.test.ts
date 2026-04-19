/**
 * dbDrivers unit tests — openInMemorySqlJs path (Node-friendly).
 * OPFS + Capacitor paths are browser/native-only and out of scope here.
 */
import { describe, expect, it } from 'vitest';
import { openInMemorySqlJs } from '@/persistence/dbDrivers';
import * as schema from '@/persistence/schema';

describe('openInMemorySqlJs', () => {
  it('returns a DriverResult with a drizzle client + sql.js handles', async () => {
    const res = await openInMemorySqlJs(schema);
    expect(res.drizzle).toBeDefined();
    expect(res.sqlJsDb).toBeDefined();
    expect(res.sqlJsMod).toBeDefined();
    expect(typeof res.sqlJsDb.run).toBe('function');
  });

  it('each call returns a fresh independent database', async () => {
    const a = await openInMemorySqlJs(schema);
    const b = await openInMemorySqlJs(schema);
    expect(a.sqlJsDb).not.toBe(b.sqlJsDb);
  });

  it('drizzle client forwards basic SQL queries', async () => {
    const { drizzle, sqlJsDb } = await openInMemorySqlJs(schema);
    // Create a minimal table via raw sql.js then read via drizzle proxy.
    sqlJsDb.run('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT);');
    sqlJsDb.run("INSERT INTO t (id, v) VALUES (1, 'hello');");
    // Use the low-level drizzle session to run a raw SELECT via the proxy.
    // drizzle-orm/sqlite-proxy exposes .session.prepareQuery / .all — for our
    // purposes we only need to confirm the proxy doesn't throw on a .get-style
    // lookup.
    // biome-ignore lint/suspicious/noExplicitAny: testing raw proxy plumbing
    const all = await (drizzle as any).all('SELECT id, v FROM t');
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBe(1);
  });

  it('rejects (via promise rejection) on malformed SQL', async () => {
    const { drizzle } = await openInMemorySqlJs(schema);
    // biome-ignore lint/suspicious/noExplicitAny: raw proxy call
    await expect((drizzle as any).all('SELECT * FROM nonexistent_table')).rejects.toThrow();
  });

  it('drizzle instance is the one from the proxy (not a raw sql.js DB)', async () => {
    const { drizzle } = await openInMemorySqlJs(schema);
    // Drizzle clients don't expose .run() from sql.js; instead they expose
    // orm-level helpers like .select() / .all()
    expect(typeof (drizzle as unknown as { select: unknown }).select).toBe('function');
  });
});
