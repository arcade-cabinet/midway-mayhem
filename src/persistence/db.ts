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
 *
 * Platform-specific driver construction lives in dbDrivers.ts.
 */

import { sql } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import {
  openCapacitorConnection,
  openInMemorySqlJs,
  openOpfsSqlJs,
  type SqliteConnection,
  type SqlJsDatabase,
} from './dbDrivers';
import * as schema from './schema';

// ─── Platform detection ────────────────────────────────────────────────────

function isTestEnv(): boolean {
  if (
    typeof process !== 'undefined' &&
    (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test')
  ) {
    return true;
  }
  // Vitest browser mode: process.env is missing in the browser realm but
  // import.meta.env carries MODE='test' and TEST=true. Without this path the
  // browser tests route to OPFS and collide on shared file handles across
  // parallel test files — producing NotFoundError flakes on CI.
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const env = import.meta.env as Record<string, unknown>;
    if (env.TEST === true || env.MODE === 'test' || env.VITEST === true) return true;
  }
  return false;
}

function isNativePlatform(): boolean {
  // biome-ignore lint/suspicious/noExplicitAny: Capacitor injected at runtime
  const cap = (globalThis as any).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

function hasOpfsSupport(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
}

// ─── State ─────────────────────────────────────────────────────────────────

let _drizzle: SqliteRemoteDatabase<typeof schema> | null = null;
let _sqliteDb: SqliteConnection | null = null;
let _sqlJsDb: SqlJsDatabase = null;
let _opfsFile: FileSystemFileHandle | null = null;
let _initPromise: Promise<void> | null = null;

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
    // Stage everything into locals so a mid-init failure leaves the module
    // handles null instead of poisoned. Only publish after migrations +
    // defaults succeed — a later initDb() call will then re-run cleanly.
    let stagedDrizzle: SqliteRemoteDatabase<typeof schema> | null = null;
    let stagedSqlJsDb: SqlJsDatabase = null;
    let stagedSqliteDb: SqliteConnection | null = null;
    let stagedOpfsFile: FileSystemFileHandle | null = null;
    try {
      const native = isNativePlatform();
      if (isTestEnv() || typeof window === 'undefined') {
        const result = await openInMemorySqlJs(schema);
        stagedDrizzle = result.drizzle;
        stagedSqlJsDb = result.sqlJsDb;
      } else if (native) {
        const result = await openCapacitorConnection(true, schema);
        stagedDrizzle = result.drizzle;
        stagedSqliteDb = result.sqliteDb ?? null;
      } else if (hasOpfsSupport()) {
        const result = await openOpfsSqlJs(schema);
        stagedDrizzle = result.drizzle;
        stagedSqlJsDb = result.sqlJsDb;
        stagedOpfsFile = result.opfsFile ?? null;
      } else {
        // Fallback: in-memory sql.js (data not persisted across page loads)
        const result = await openInMemorySqlJs(schema);
        stagedDrizzle = result.drizzle;
        stagedSqlJsDb = result.sqlJsDb;
      }
      _drizzle = stagedDrizzle;
      _sqlJsDb = stagedSqlJsDb;
      _sqliteDb = stagedSqliteDb;
      _opfsFile = stagedOpfsFile;
      await runMigrations();
      await seedDefaults();
    } catch (err) {
      _drizzle = null;
      _sqlJsDb = null;
      _sqliteDb = null;
      _opfsFile = null;
      throw err;
    }
  })().finally(() => {
    _initPromise = null;
  });

  return _initPromise;
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
      /* cleanup — not fatal */
    }
    _sqlJsDb = null;
    _opfsFile = null;
  }
  if (_sqliteDb) {
    try {
      await _sqliteDb.close();
    } catch {
      /* cleanup — not fatal */
    }
    _sqliteDb = null;
  }
  _drizzle = null;
  _initPromise = null;
}
