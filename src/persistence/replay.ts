/**
 * @module persistence/replay
 *
 * Save, list, and retrieve input-trace replays for the ghost-car feature.
 * Enforces a max-20-per-date cap by deleting the oldest rows on overflow.
 */
import { asc, desc, eq } from 'drizzle-orm';
import { db } from './db';
import { replays } from './schema';

export interface ReplaySample {
  /** Elapsed time in seconds from run start */
  t: number;
  lateral: number;
  speedMps: number;
  steer: number;
}

export interface ReplayRow {
  id: number;
  dailyDate: string;
  distanceCm: number;
  crowd: number;
  trace: ReplaySample[];
  createdAt: number;
}

const MAX_REPLAYS_PER_DATE = 20;

export async function saveReplay(
  date: string,
  distance: number,
  crowd: number,
  trace: ReplaySample[],
): Promise<void> {
  const now = Date.now();
  const distanceCm = Math.round(distance * 100);
  const inputTraceJson = JSON.stringify(trace);

  await db()
    .insert(replays)
    .values({ dailyDate: date, distanceCm, crowd, inputTraceJson, createdAt: now })
    .run();

  // Enforce cap: keep only the 20 most recent rows for this date
  const all = await db()
    .select({ id: replays.id })
    .from(replays)
    .where(eq(replays.dailyDate, date))
    .orderBy(asc(replays.createdAt))
    .all();

  if (all.length > MAX_REPLAYS_PER_DATE) {
    const toDelete = all.slice(0, all.length - MAX_REPLAYS_PER_DATE);
    for (const row of toDelete) {
      await db().delete(replays).where(eq(replays.id, row.id)).run();
    }
  }
}

export async function listReplaysForDate(date: string): Promise<ReplayRow[]> {
  const rows = await db()
    .select()
    .from(replays)
    .where(eq(replays.dailyDate, date))
    .orderBy(desc(replays.createdAt), desc(replays.id))
    .all();

  return rows.map((r) => ({
    id: r.id,
    dailyDate: r.dailyDate,
    distanceCm: r.distanceCm,
    crowd: r.crowd,
    trace: JSON.parse(r.inputTraceJson) as ReplaySample[],
    createdAt: r.createdAt,
  }));
}

export async function getBestReplayForDate(date: string): Promise<ReplayRow | null> {
  const row = await db()
    .select()
    .from(replays)
    .where(eq(replays.dailyDate, date))
    .orderBy(desc(replays.distanceCm), desc(replays.crowd))
    .get();

  if (!row || row.inputTraceJson == null) return null;

  return {
    id: row.id,
    dailyDate: row.dailyDate,
    distanceCm: row.distanceCm,
    crowd: row.crowd,
    trace: JSON.parse(row.inputTraceJson) as ReplaySample[],
    createdAt: row.createdAt,
  };
}

/**
 * Fetch the N most recent replay rows across all dates, ordered by creation
 * time descending. Used by GhostMenu (D4) to show the last 5 runs.
 */
export async function getRecentRuns(limit = 5): Promise<ReplayRow[]> {
  const rows = await db()
    .select()
    .from(replays)
    .orderBy(desc(replays.createdAt), desc(replays.id))
    .limit(limit)
    .all();

  return rows.map((r) => ({
    id: r.id,
    dailyDate: r.dailyDate,
    distanceCm: r.distanceCm,
    crowd: r.crowd,
    trace: JSON.parse(r.inputTraceJson) as ReplaySample[],
    createdAt: r.createdAt,
  }));
}

/** Compare two replays by identity (same id). Used by GhostCar to skip rendering self. */
export function replaysEqual(a: ReplayRow | null, b: ReplayRow | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.id === b.id;
}
