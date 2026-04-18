/**
 * Score persistence — Capacitor SQLite on native, localStorage fallback on
 * web. Public surface: saveScore + loadTopScores. Everything is async so
 * the same interface works whether the backing store is a plugin call or
 * a synchronous browser API.
 *
 * On web the DB "schema" is just a JSON array of ScoreRow at the key
 * "mm.scores.v1" — good enough for leaderboard display.
 */

export interface ScoreRow {
  score: number;
  balloons: number;
  seed: number;
  timestamp: number;
}

const LS_KEY = 'mm.scores.v1';
const MAX_ROWS = 25;

async function hasNativeSqlite(): Promise<boolean> {
  try {
    const cap = (await import('@capacitor/core')) as {
      Capacitor: { isNativePlatform: () => boolean };
    };
    return cap.Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

interface DbConn {
  open: () => Promise<void>;
  execute: (sql: string) => Promise<unknown>;
  run: (sql: string, values?: unknown[]) => Promise<unknown>;
  query: (sql: string, values?: unknown[]) => Promise<{ values?: ScoreRow[] }>;
  close: () => Promise<void>;
}
interface DbConnector {
  isConnection: (name: string, readOnly: boolean) => Promise<{ result: boolean }>;
  createConnection: (
    name: string,
    encrypted: boolean,
    mode: string,
    version: number,
    readOnly: boolean,
  ) => Promise<DbConn>;
  retrieveConnection: (name: string, readOnly: boolean) => Promise<DbConn>;
}

async function openDb(): Promise<DbConn> {
  const mod = (await import('@capacitor-community/sqlite')) as unknown as {
    CapacitorSQLite: unknown;
    SQLiteConnection: new (cs: unknown) => DbConnector;
  };
  const conn = new mod.SQLiteConnection(mod.CapacitorSQLite);
  const exists = await conn.isConnection('midway-mayhem', false);
  const db = exists.result
    ? await conn.retrieveConnection('midway-mayhem', false)
    : await conn.createConnection('midway-mayhem', false, 'no-encryption', 1, false);
  await db.open();
  await db.execute(
    'CREATE TABLE IF NOT EXISTS scores (score REAL, balloons INTEGER, seed INTEGER, timestamp INTEGER);',
  );
  return db;
}

async function nativeSaveScore(row: ScoreRow): Promise<void> {
  const db = await openDb();
  await db.run('INSERT INTO scores (score, balloons, seed, timestamp) VALUES (?, ?, ?, ?);', [
    row.score,
    row.balloons,
    row.seed,
    row.timestamp,
  ]);
  await db.close();
}

async function nativeLoadTopScores(limit: number): Promise<ScoreRow[]> {
  const db = await openDb();
  const res = await db.query(
    'SELECT score, balloons, seed, timestamp FROM scores ORDER BY score DESC LIMIT ?;',
    [limit],
  );
  await db.close();
  return res.values ?? [];
}

function webReadAll(): ScoreRow[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScoreRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function webWriteAll(rows: ScoreRow[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify(rows.slice(0, MAX_ROWS)));
}

export async function saveScore(row: ScoreRow): Promise<void> {
  if (await hasNativeSqlite()) {
    try {
      await nativeSaveScore(row);
      return;
    } catch {
      // Fall through to web path if the plugin surface errors out.
    }
  }
  const rows = webReadAll();
  rows.push(row);
  rows.sort((a, b) => b.score - a.score);
  webWriteAll(rows);
}

export async function loadTopScores(limit = 5): Promise<ScoreRow[]> {
  if (await hasNativeSqlite()) {
    try {
      return await nativeLoadTopScores(limit);
    } catch {
      // Fall through.
    }
  }
  return webReadAll().slice(0, limit);
}
