/**
 * @module persistence/dbDrivers
 *
 * Concrete Drizzle driver builders for each platform path:
 *   - openInMemorySqlJs  — Node / test environment
 *   - openOpfsSqlJs      — Web browser with OPFS (durable)
 *   - openCapacitorConnection — iOS / Android native
 *
 * All functions mutate the state refs passed in by the caller (db.ts).
 * They return `DrizzleState` which db.ts stores and exposes via `db()`.
 */

import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import initSqlJs from 'sql.js';
import type * as schema from './schema';

const DB_NAME = 'midway-mayhem.db';
const DB_VERSION = 1;

export type DbSchema = typeof schema;

// biome-ignore lint/suspicious/noExplicitAny: sql.js Database type varies
export type SqlJsDatabase = any;
// biome-ignore lint/suspicious/noExplicitAny: sql.js module type varies
export type SqlJsModule = any;
export type SqliteConnection = import('@capacitor-community/sqlite').SQLiteDBConnection;

export interface DriverResult {
  drizzle: SqliteRemoteDatabase<DbSchema>;
  sqlJsDb?: SqlJsDatabase;
  sqlJsMod?: SqlJsModule;
  opfsFile?: FileSystemFileHandle;
  sqliteDb?: SqliteConnection;
}

// ─── Utility row helpers ────────────────────────────────────────────────────

function normalizeRows(values: unknown[] | undefined): unknown[] {
  return Array.isArray(values) ? values : [];
}

function rowsToValueArrays(rows: unknown[]): unknown[][] {
  return rows.map((row) => {
    if (Array.isArray(row)) return row;
    if (row && typeof row === 'object') return Object.values(row as Record<string, unknown>);
    return [row];
  });
}

// ─── sql.js Drizzle proxy builder ───────────────────────────────────────────

function buildSqlJsDrizzle(
  // biome-ignore lint/suspicious/noExplicitAny: sql.js dynamic
  getDb: () => any,
  schemaObj: DbSchema,
): SqliteRemoteDatabase<DbSchema> {
  return drizzle<DbSchema>(
    async (sql, params, method) => {
      const d = getDb();
      try {
        if (method === 'run') {
          d.run(sql, params);
          return { rows: [] };
        }
        const stmt = d.prepare(sql);
        stmt.bind(params);
        const rows: unknown[][] = [];
        while (stmt.step()) rows.push(stmt.get());
        stmt.free();
        if (method === 'get') {
          return { rows: rows[0] as unknown[] } as { rows: unknown[] };
        }
        return { rows };
      } catch (err) {
        throw new Error(`[db:sqljs] ${String(err)}\nSQL: ${sql}`);
      }
    },
    { schema: schemaObj },
  );
}

// ─── In-memory sql.js (tests + fallback) ────────────────────────────────────

export async function openInMemorySqlJs(schemaObj: DbSchema): Promise<DriverResult> {
  const sqlJsMod = await initSqlJs();
  const sqlJsDb = new sqlJsMod.Database();
  const drizzleDb = buildSqlJsDrizzle(() => sqlJsDb, schemaObj);
  return { drizzle: drizzleDb, sqlJsDb, sqlJsMod };
}

// ─── OPFS + sql.js (web browser with durable persistence) ───────────────────

export async function openOpfsSqlJs(schemaObj: DbSchema): Promise<DriverResult> {
  // Locate the WASM binary — Vite copies it to /public/assets via copywasm.ts
  let wasmUrl: string;
  if (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL != null) {
    const base = import.meta.env.BASE_URL as string;
    wasmUrl = `${base.endsWith('/') ? base : `${base}/`}assets/sql-wasm.wasm`;
  } else {
    wasmUrl = '/assets/sql-wasm.wasm';
  }

  const sqlJsMod = await initSqlJs({ locateFile: () => wasmUrl });

  // Read existing DB from OPFS if available
  const root = await navigator.storage.getDirectory();
  const opfsFile = await root.getFileHandle(DB_NAME, { create: true });
  const existing = await opfsFile.getFile();
  const buf = await existing.arrayBuffer();

  const sqlJsDb =
    buf.byteLength > 0
      ? new sqlJsMod.Database(new Uint8Array(buf))
      : new sqlJsMod.Database();

  const drizzleDb = buildSqlJsDrizzle(() => sqlJsDb, schemaObj);
  return { drizzle: drizzleDb, sqlJsDb, sqlJsMod, opfsFile };
}

// ─── CapacitorSQLite path (iOS / Android) ───────────────────────────────────

function getBaseAssetPath(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL != null) {
    const base = import.meta.env.BASE_URL as string;
    return `${base.endsWith('/') ? base : `${base}/`}assets`;
  }
  return '/assets';
}

async function ensureJeepElement(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const { defineCustomElements } = await import('jeep-sqlite/loader');
  await defineCustomElements(window);
  let el = document.querySelector('jeep-sqlite');
  if (!el) {
    el = document.createElement('jeep-sqlite');
    el.setAttribute('wasmpath', getBaseAssetPath());
    document.body.appendChild(el);
  }
  await customElements.whenDefined('jeep-sqlite');
}

export async function openCapacitorConnection(
  isNative: boolean,
  schemaObj: DbSchema,
): Promise<DriverResult> {
  const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');

  if (!isNative) await ensureJeepElement();

  const mgr = new SQLiteConnection(CapacitorSQLite);
  if (!isNative) await mgr.initWebStore();

  const exists = (await mgr.isConnection(DB_NAME, false)).result;
  const sqliteDb = exists
    ? await mgr.retrieveConnection(DB_NAME, false)
    : await mgr.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);

  await sqliteDb.open();
  const conn = sqliteDb;

  const drizzleDb = drizzle<DbSchema>(
    async (sql, params, method) => {
      switch (method) {
        case 'run': {
          const r = await conn.run(sql, params, false);
          return { rows: r.changes?.values ?? [] };
        }
        case 'get': {
          const r = await conn.query(sql, params);
          const rows = rowsToValueArrays(normalizeRows(r.values));
          return { rows: rows[0] ?? [] } as { rows: unknown[] };
        }
        default: {
          const r = await conn.query(sql, params);
          return { rows: rowsToValueArrays(normalizeRows(r.values)) };
        }
      }
    },
    { schema: schemaObj },
  );

  return { drizzle: drizzleDb, sqliteDb };
}
