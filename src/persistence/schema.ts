/**
 * @module persistence/schema
 *
 * Drizzle ORM table definitions for Midway Mayhem local SQLite database.
 *
 * Tables:
 *   profile        — singleton row: tickets, run stats, best metrics
 *   unlocks        — purchased items per kind (palette, ornament, horn, etc.)
 *   loadout        — singleton row: currently equipped slugs per slot
 *   daily_runs     — best run per UTC date (primary key = date string)
 *   replays        — input traces, max 20 per date, for ghost car replay
 *   achievements   — achievement catalog state + incremental progress
 *   lifetime_stats — singleton row: all-time counters and personal bests
 *
 * Settings and tutorial flags live in @capacitor/preferences (KV).
 */
import {
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export type UnlockKind =
  | 'palette'
  | 'ornament'
  | 'horn'
  | 'starting_zone'
  | 'rim'
  | 'dice'
  | 'horn_shape';

/**
 * Single-row player profile (id = 1).
 * Tracks ticket balance, run count, personal bests.
 */
export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  tickets: integer('tickets').notNull().default(0),
  totalRuns: integer('total_runs').notNull().default(0),
  bestDistanceCm: integer('best_distance_cm').notNull().default(0),
  bestCrowd: integer('best_crowd').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * Unlock ledger — one row per purchased item.
 * kind = palette | ornament | horn | starting_zone | rim | dice | horn_shape
 */
export const unlocks = sqliteTable(
  'unlocks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind').$type<UnlockKind>().notNull(),
    slug: text('slug').notNull(),
    unlockedAt: integer('unlocked_at').notNull(),
  },
  (table) => [index('idx_unlocks_kind_slug').on(table.kind, table.slug)],
);

/**
 * Single-row active loadout (id = 1) — slugs of the currently equipped items.
 * Each column points to a slug that must exist in the unlocks table.
 */
export const loadout = sqliteTable('loadout', {
  id: integer('id').primaryKey(),
  palette: text('palette').notNull().default('classic'),
  ornament: text('ornament').notNull().default('flower'),
  horn: text('horn').notNull().default('classic-beep'),
  rim: text('rim').notNull().default('chrome'),
  dice: text('dice').notNull().default('red-spots'),
  hornShape: text('horn_shape').notNull().default('round'),
});

/**
 * Best daily run per UTC date (yyyy-mm-dd primary key).
 */
export const dailyRuns = sqliteTable('daily_runs', {
  dateUtc: text('date_utc').primaryKey(),
  seed: integer('seed').notNull(),
  bestDistanceCm: integer('best_distance_cm').notNull().default(0),
  bestCrowd: integer('best_crowd').notNull().default(0),
  runCount: integer('run_count').notNull().default(0),
});

/**
 * Input-trace replays — up to 20 per daily date.
 * input_trace_json is a JSON array of { t, lateral, speedMps, steer } samples.
 */
export const replays = sqliteTable(
  'replays',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    dailyDate: text('daily_date').notNull(),
    distanceCm: integer('distance_cm').notNull(),
    crowd: integer('crowd').notNull(),
    inputTraceJson: text('input_trace_json').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_replays_daily_date').on(table.dailyDate)],
);

/**
 * Achievement unlock ledger.
 * One row per achievement slug, created when first earned or when progress begins.
 * progress_value / target_value enable partial-progress display for cumulative goals.
 */
export const achievements = sqliteTable(
  'achievements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull().unique(),
    unlockedAt: integer('unlocked_at'), // NULL until earned
    progressValue: integer('progress_value').notNull().default(0),
    targetValue: integer('target_value').notNull().default(1),
  },
  (table) => [index('idx_achievements_slug').on(table.slug)],
);

/**
 * Singleton lifetime-stats row (id = 1).
 * All counters are cumulative across every run ever played.
 * best_zone_time_ms is a JSON object keyed by ZoneId.
 */
export const lifetimeStats = sqliteTable('lifetime_stats', {
  id: integer('id').primaryKey(),
  totalDistanceCm: integer('total_distance_cm').notNull().default(0),
  totalCrashes: integer('total_crashes').notNull().default(0),
  totalScares: integer('total_scares').notNull().default(0),
  totalTicketsEarned: integer('total_tickets_earned').notNull().default(0),
  totalRunsCompleted: integer('total_runs_completed').notNull().default(0),
  totalGameOversByPlunge: integer('total_game_overs_by_plunge').notNull().default(0),
  totalGameOversBySanity: integer('total_game_overs_by_sanity').notNull().default(0),
  longestComboChain: integer('longest_combo_chain').notNull().default(0),
  maxSingleRunCrowd: integer('max_single_run_crowd').notNull().default(0),
  bestZoneTimeMs: text('best_zone_time_ms').notNull().default('{}'),
  secondsPlayed: integer('seconds_played').notNull().default(0),
});
