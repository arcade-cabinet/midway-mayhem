/**
 * @module persistence/db
 *
 * Opens the Midway Mayhem SQLite database with three platform paths:
 *
 *   - Test / Node:  sql.js in-memory (no browser APIs needed)
 *   - Web (browser): sql.js with OPFS (navigator.storage.getDirectory()) for
 *                    durable persistence — binary DB saved to origin private FS
 *   - iOS / Android: native SQLite via @capacitor-community/sqlite
 *
 * OPFS is used for web (not IndexedDB or localStorage) because it is the
 * fastest and most reliable persistence layer for binary blobs in Chromium.
 * Safari 16.4+ and Firefox 111+ also support OPFS.
 *
 * Drizzle ORM wraps the async connection through the sqlite-proxy driver.
 * All DDL is run inline via runMigrations() — no separate migration files.
 */

import { sql } from 'drizzle-orm';
import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import initSqlJs from 'sql.js';
import * as schema from './schema';

const DB_NAME = 'midway-mayhem.db';
const DB_VERSION = 1;

// ─── Platform detection ────────────────────────────────────────────────────

function isTestEnv(): boolean {
  return (
    typeof process !== 'undefined' &&
    (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test')
  );
}

function isNativePlatform(): boolean {
  // biome-ignore lint/suspicious/noExplicitAny: Capacitor injected at runtime
  const cap = (globalThis as any).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

function hasOpfsSupport(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
}

// ─── State ────────────────────────────────────���────────────────────────────

type SqliteConnection = import('@capacitor-community/sqlite').SQLiteDBConnection;

let _drizzle: SqliteRemoteDatabase<typeof schema> | null = null;
let _sqliteDb: SqliteConnection | null = null;
// biome-ignore lint/suspicious/noExplicitAny: sql.js Database type varies
let _sqlJsDb: any = null;
// biome-ignore lint/suspicious/noExplicitAny: sql.js module
let _sqlJsMod: any = null;
let _opfsFile: FileSystemFileHandle | null = null;
let _initPromise: Promise<void> | null = null;

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

// ─── In-memory sql.js path (tests + fallback) ───────────────────────────────

async function openInMemorySqlJs(): Promise<void> {
  _sqlJsMod = await initSqlJs();
  _sqlJsDb = new _sqlJsMod.Database();
  _drizzle = buildSqlJsDrizzle();
}

// ─── OPFS + sql.js path (web browser with durable persistence) ──────────────

async function openOpfsSqlJs(): Promise<void> {
  // Locate the WASM binary — Vite copies it to /public/assets via copywasm.ts
  let wasmUrl: string;
  if (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL != null) {
    const base = import.meta.env.BASE_URL as string;
    wasmUrl = `${base.endsWith('/') ? base : `${base}/`}assets/sql-wasm.wasm`;
  } else {
    wasmUrl = '/assets/sql-wasm.wasm';
  }

  _sqlJsMod = await initSqlJs({ locateFile: () => wasmUrl });

  // Read existing DB from OPFS if available
  const root = await navigator.storage.getDirectory();
  _opfsFile = await root.getFileHandle(DB_NAME, { create: true });

  const existing = await _opfsFile.getFile();
  const buf = await existing.arrayBuffer();

  if (buf.byteLength > 0) {
    _sqlJsDb = new _sqlJsMod.Database(new Uint8Array(buf));
  } else {
    _sqlJsDb = new _sqlJsMod.Database();
  }

  _drizzle = buildSqlJsDrizzle();
}

/** Build the Drizzle proxy for the active sql.js Database instance. */
function buildSqlJsDrizzle(): SqliteRemoteDatabase<typeof schema> {
  return drizzle<typeof schema>(
    async (sql, params, method) => {
      const d = _sqlJsDb;
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
          // Drizzle uses rows as the raw row; undefined signals "no result" so
          // mapGetResult returns undefined instead of a partial object.
          return { rows: rows[0] as unknown[] } as { rows: unknown[] };
        }
        return { rows };
      } catch (err) {
        throw new Error(`[db:sqljs] ${String(err)}\nSQL: ${sql}`);
      }
    },
    { schema },
  );
}

/** Flush current sql.js in-memory state to OPFS. */
export async function persistToOpfs(): Promise<void> {
  if (!_opfsFile || !_sqlJsDb) return;
  const data: Uint8Array = _sqlJsDb.export();
  const writable = await _opfsFile.createWritable();
  // Copy into a fresh ArrayBuffer — OPFS write signature requires
  // ArrayBufferView<ArrayBuffer>, not SharedArrayBuffer-backed views.
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  await writable.write(copy);
  await writable.close();
}

// ─── CapacitorSQLite path (iOS / Android) ──────────────────────────────────

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

async function openCapacitorConnection(): Promise<void> {
  const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');

  // On native, jeep-sqlite element is not needed; on web fallback it would be,
  // but we only call this path on native platforms.
  if (!isNativePlatform()) await ensureJeepElement();

  const mgr = new SQLiteConnection(CapacitorSQLite);

  if (!isNativePlatform()) await mgr.initWebStore();

  const exists = (await mgr.isConnection(DB_NAME, false)).result;
  _sqliteDb = exists
    ? await mgr.retrieveConnection(DB_NAME, false)
    : await mgr.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);

  await _sqliteDb.open();

  const conn = _sqliteDb;

  _drizzle = drizzle<typeof schema>(
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
    { schema },
  );
}

// ─── DDL (v1, idempotent) ───────────────────────────────────────────────────

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY,
    tickets INTEGER NOT NULL DEFAULT 0,
    total_runs INTEGER NOT NULL DEFAULT 0,
    best_distance_cm INTEGER NOT NULL DEFAULT 0,
    best_crowd INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS unlocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    slug TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_unlocks_kind_slug ON unlocks (kind, slug)`,
  `CREATE TABLE IF NOT EXISTS loadout (
    id INTEGER PRIMARY KEY,
    palette TEXT NOT NULL DEFAULT 'classic',
    ornament TEXT NOT NULL DEFAULT 'flower',
    horn TEXT NOT NULL DEFAULT 'classic-beep',
    rim TEXT NOT NULL DEFAULT 'chrome',
    dice TEXT NOT NULL DEFAULT 'red-spots',
    horn_shape TEXT NOT NULL DEFAULT 'round'
  )`,
  `CREATE TABLE IF NOT EXISTS daily_runs (
    date_utc TEXT PRIMARY KEY,
    seed INTEGER NOT NULL,
    best_distance_cm INTEGER NOT NULL DEFAULT 0,
    best_crowd INTEGER NOT NULL DEFAULT 0,
    run_count INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS replays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    daily_date TEXT NOT NULL,
    distance_cm INTEGER NOT NULL,
    crowd INTEGER NOT NULL,
    input_trace_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_replays_daily_date ON replays (daily_date)`,
  `CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    unlocked_at INTEGER,
    progress_value INTEGER NOT NULL DEFAULT 0,
    target_value INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE INDEX IF NOT EXISTS idx_achievements_slug ON achievements (slug)`,
  `CREATE TABLE IF NOT EXISTS lifetime_stats (
    id INTEGER PRIMARY KEY,
    total_distance_cm INTEGER NOT NULL DEFAULT 0,
    total_crashes INTEGER NOT NULL DEFAULT 0,
    total_scares INTEGER NOT NULL DEFAULT 0,
    total_tickets_earned INTEGER NOT NULL DEFAULT 0,
    total_runs_completed INTEGER NOT NULL DEFAULT 0,
    total_game_overs_by_plunge INTEGER NOT NULL DEFAULT 0,
    total_game_overs_by_sanity INTEGER NOT NULL DEFAULT 0,
    longest_combo_chain INTEGER NOT NULL DEFAULT 0,
    max_single_run_crowd INTEGER NOT NULL DEFAULT 0,
    best_zone_time_ms TEXT NOT NULL DEFAULT '{}',
    seconds_played INTEGER NOT NULL DEFAULT 0
  )`,
];

async function runMigrations(): Promise<void> {
  const d = _drizzle;
  if (!d) throw new Error('[db] drizzle not initialized before runMigrations');
  for (const stmt of DDL_STATEMENTS) {
    await d.run(stmt);
  }
}

async function seedDefaults(): Promise<void> {
  const d = _drizzle;
  if (!d) return;
  const now = Date.now();
  await d.run(
    sql`INSERT OR IGNORE INTO profile (id, tickets, total_runs, best_distance_cm, best_crowd, created_at, updated_at) VALUES (1, 0, 0, 0, 0, ${now}, ${now})`,
  );
  await d.run(
    `INSERT OR IGNORE INTO loadout (id, palette, ornament, horn, rim, dice, horn_shape) VALUES (1, 'classic', 'flower', 'classic-beep', 'chrome', 'red-spots', 'round')`,
  );
  await d.run(
    `INSERT OR IGNORE INTO lifetime_stats (id, total_distance_cm, total_crashes, total_scares, total_tickets_earned, total_runs_completed, total_game_overs_by_plunge, total_game_overs_by_sanity, longest_combo_chain, max_single_run_crowd, best_zone_time_ms, seconds_played) VALUES (1, 0, 0, 0, 0, 0, 0, 0, 0, 0, '{}', 0)`,
  );
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialize DB. Safe to call multiple times — idempotent.
 */
export async function initDb(): Promise<void> {
  if (_drizzle) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    if (isTestEnv() || typeof window === 'undefined') {
      await openInMemorySqlJs();
    } else if (isNativePlatform()) {
      await openCapacitorConnection();
    } else if (hasOpfsSupport()) {
      await openOpfsSqlJs();
    } else {
      // Fallback: in-memory sql.js (data not persisted across page loads)
      await openInMemorySqlJs();
    }
    await runMigrations();
    await seedDefaults();
  })().finally(() => {
    _initPromise = null;
  });

  return _initPromise;
}

/**
 * Returns the initialized Drizzle ORM instance. Throws if initDb() not called.
 */
export function db(): SqliteRemoteDatabase<typeof schema> {
  if (!_drizzle) {
    throw new Error('[db] Database not initialized. Call initDb() first.');
  }
  return _drizzle;
}

/**
 * Tear down and reset for tests. No-op outside test environments.
 */
export async function resetDbForTests(): Promise<void> {
  if (_sqlJsDb) {
    try {
      _sqlJsDb.close?.();
    } catch {
      /* ignore */
    }
    _sqlJsDb = null;
    _sqlJsMod = null;
    _opfsFile = null;
  }
  if (_sqliteDb) {
    try {
      await _sqliteDb.close();
    } catch {
      /* ignore */
    }
    _sqliteDb = null;
  }
  _drizzle = null;
  _initPromise = null;
}
