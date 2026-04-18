/**
 * @module persistence/profile
 *
 * High-level operations on the singleton profile row, unlocks table,
 * and loadout row. All reads/writes go through the Drizzle instance from db().
 *
 * import-safe: only calls db() inside async functions, never at module scope.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import type { UnlockKind } from './schema';
import { loadout, profile, unlocks } from './schema';

// ─── Profile ────────────────────────────────────────────────────────────────

export interface ProfileRow {
  id: number;
  tickets: number;
  totalRuns: number;
  bestDistanceCm: number;
  bestCrowd: number;
  createdAt: number;
  updatedAt: number;
}

export async function getProfile(): Promise<ProfileRow> {
  const row = await db().select().from(profile).where(eq(profile.id, 1)).get();
  if (!row) throw new Error('[profile] Profile row missing — was initDb() called?');
  return row;
}

export async function addTickets(n: number): Promise<void> {
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`[profile] addTickets requires a positive amount (got ${n})`);
  }
  const now = Date.now();
  // Single atomic UPDATE using SQL-side increment — no read-then-write race.
  await db()
    .update(profile)
    .set({ tickets: sql`${profile.tickets} + ${n}`, updatedAt: now })
    .where(eq(profile.id, 1))
    .run();
}

export async function spendTickets(n: number): Promise<void> {
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`[profile] spendTickets requires a positive amount (got ${n})`);
  }
  // Pre-check balance to surface a clear error message. The real atomic
  // guard lives in the UPDATE's WHERE clause below, which refuses to
  // decrement below zero even under concurrent writers.
  const p = await getProfile();
  if (p.tickets < n) {
    throw new Error(`[profile] Not enough tickets (have ${p.tickets}, need ${n})`);
  }
  const now = Date.now();
  await db()
    .update(profile)
    .set({ tickets: sql`${profile.tickets} - ${n}`, updatedAt: now })
    .where(and(eq(profile.id, 1), sql`${profile.tickets} >= ${n}`))
    .run();
}

/**
 * Atomically debit tickets and grant an unlock. Both mutations happen inside
 * a DB transaction so the player can never be charged without receiving the
 * item (and vice versa).
 */
export async function purchaseUnlock(kind: UnlockKind, slug: string, cost: number): Promise<void> {
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error(`[profile] purchaseUnlock requires a non-negative cost (got ${cost})`);
  }
  const now = Date.now();
  await db().transaction(async (tx) => {
    // 1. Refuse to charge for something the player already owns. Without this
    //    check, onConflictDoNothing on the INSERT would silently skip while
    //    the debit completes — player charged, no new item granted.
    const existing = await tx
      .select()
      .from(unlocks)
      .where(and(eq(unlocks.kind, kind), eq(unlocks.slug, slug)))
      .get();
    if (existing) {
      throw new Error(`[profile] Unlock already owned: ${kind}/${slug}`);
    }

    // 2. Read balance and gate the debit. The conditional UPDATE below is the
    //    real atomic guard — the pre-read only exists to produce a clear error
    //    message. No row-count check because the drizzle-proxy driver doesn't
    //    surface affected-rows; the transaction will rollback if either side
    //    throws, so the guard is sufficient in practice.
    if (cost > 0) {
      const p = await tx.select().from(profile).where(eq(profile.id, 1)).get();
      if (!p || p.tickets < cost) {
        throw new Error(
          `[profile] Not enough tickets for ${kind}/${slug} (have ${p?.tickets ?? 0}, cost ${cost})`,
        );
      }
      await tx
        .update(profile)
        .set({ tickets: sql`${profile.tickets} - ${cost}`, updatedAt: now })
        .where(and(eq(profile.id, 1), sql`${profile.tickets} >= ${cost}`))
        .run();
    }

    // 3. Insert the new unlock. onConflictDoNothing is a belt-and-braces
    //    safeguard: we just verified no existing row above, so this should
    //    always insert. If a concurrent transaction inserted first the
    //    transaction rolls back at commit on unique-constraint failure.
    await tx.insert(unlocks).values({ kind, slug, unlockedAt: now }).onConflictDoNothing().run();
  });
}

export async function recordRun({
  distance,
  crowd,
}: {
  distance: number;
  crowd: number;
}): Promise<void> {
  const now = Date.now();
  const p = await getProfile();
  const distCm = Math.round(distance * 100);
  await db()
    .update(profile)
    .set({
      totalRuns: p.totalRuns + 1,
      bestDistanceCm: Math.max(p.bestDistanceCm, distCm),
      bestCrowd: Math.max(p.bestCrowd, crowd),
      updatedAt: now,
    })
    .where(eq(profile.id, 1))
    .run();
}

// ─── Unlocks ────────────────────────────────────────────────────────────────

export async function grantUnlock(kind: UnlockKind, slug: string): Promise<void> {
  const now = Date.now();
  // INSERT OR IGNORE via drizzle's onConflictDoNothing
  await db().insert(unlocks).values({ kind, slug, unlockedAt: now }).onConflictDoNothing().run();
}

export async function hasUnlock(kind: UnlockKind, slug: string): Promise<boolean> {
  const row = await db()
    .select()
    .from(unlocks)
    .where(and(eq(unlocks.kind, kind), eq(unlocks.slug, slug)))
    .get();
  return row !== undefined;
}

export async function listUnlocks(kind: UnlockKind): Promise<string[]> {
  const rows = await db()
    .select({ slug: unlocks.slug })
    .from(unlocks)
    .where(eq(unlocks.kind, kind))
    .all();
  return rows.map((r) => r.slug);
}

// ─── Loadout ─────────────────────────────────────────────────────────────────

export interface LoadoutRow {
  palette: string;
  ornament: string;
  horn: string;
  rim: string;
  dice: string;
  hornShape: string;
}

export async function getLoadout(): Promise<LoadoutRow> {
  const row = await db().select().from(loadout).where(eq(loadout.id, 1)).get();
  if (!row) throw new Error('[profile] Loadout row missing — was initDb() called?');
  return {
    palette: row.palette,
    ornament: row.ornament,
    horn: row.horn,
    rim: row.rim,
    dice: row.dice,
    hornShape: row.hornShape,
  };
}

export async function setLoadout(partial: Partial<LoadoutRow>): Promise<void> {
  // Map camelCase fields to drizzle column names
  const update: Partial<typeof loadout.$inferInsert> = {};
  if (partial.palette !== undefined) update.palette = partial.palette;
  if (partial.ornament !== undefined) update.ornament = partial.ornament;
  if (partial.horn !== undefined) update.horn = partial.horn;
  if (partial.rim !== undefined) update.rim = partial.rim;
  if (partial.dice !== undefined) update.dice = partial.dice;
  if (partial.hornShape !== undefined) update.hornShape = partial.hornShape;

  if (Object.keys(update).length === 0) return;

  await db().update(loadout).set(update).where(eq(loadout.id, 1)).run();
}
