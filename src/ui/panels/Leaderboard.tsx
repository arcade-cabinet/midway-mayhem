/**
 * @module ui/panels/Leaderboard
 *
 * Title-screen leaderboard panel — shows today's top 5 local entries
 * (distance + crowd) with date stamps and today's daily seed.
 *
 * Data source: SQLite `daily_runs` table via persistence/profile.
 * Falls back to empty state if DB not yet initialized.
 */

import { desc } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { color, elevation, radius, space } from '@/design/tokens';
import { typeStyle, ui } from '@/design/typography';
import { reportError } from '@/game/errorBus';
import { db } from '@/persistence/db';
import { dailyRuns } from '@/persistence/schema';
import { utcDateString } from '@/track/dailyRoute';
import { formatLeaderboardDistance } from '@/utils/formatters';

interface LeaderboardEntry {
  dateUtc: string;
  bestDistanceCm: number;
  bestCrowd: number;
  runCount: number;
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const today = utcDateString();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await db()
          .select()
          .from(dailyRuns)
          .orderBy(desc(dailyRuns.bestDistanceCm))
          .limit(5)
          .all();
        if (!cancelled) {
          setEntries(rows);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          reportError(err, 'Leaderboard.load');
          setLoading(false);
          setLoadError(true);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      data-testid="leaderboard"
      style={{
        background: `rgba(11,15,26,0.75)`,
        border: `2px solid ${color.borderAccent}`,
        borderRadius: radius.md,
        padding: `${space.md}px ${space.base}px`,
        boxShadow: elevation.panel,
        minWidth: 260,
      }}
    >
      {/* Header */}
      <div
        style={{
          ...typeStyle(ui.label),
          color: color.yellow,
          fontSize: '0.95rem',
          marginBottom: space.sm,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>🏆 LOCAL BESTS</span>
      </div>

      {loading ? (
        <div style={{ ...typeStyle(ui.body), color: color.dim, fontSize: '0.85rem' }}>Loading…</div>
      ) : loadError ? (
        <div style={{ ...typeStyle(ui.body), color: color.toneDanger, fontSize: '0.85rem' }}>
          Failed to load leaderboard.
        </div>
      ) : entries.length === 0 ? (
        <div style={{ ...typeStyle(ui.body), color: color.dim, fontSize: '0.85rem' }}>
          No runs yet — be first!
        </div>
      ) : (
        <div>
          {entries.map((entry, i) => (
            <div
              key={entry.dateUtc}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: `${space.xs}px 0`,
                borderBottom: i < entries.length - 1 ? `1px solid ${color.borderSubtle}` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
                <span
                  style={{
                    ...typeStyle(ui.label),
                    color: i === 0 ? color.yellow : color.dim,
                    fontSize: '0.85rem',
                    minWidth: 18,
                  }}
                >
                  {i + 1}.
                </span>
                <div>
                  <div style={{ ...typeStyle(ui.label), color: color.white, fontSize: '0.9rem' }}>
                    {formatLeaderboardDistance(entry.bestDistanceCm)}
                  </div>
                  <div style={{ ...typeStyle(ui.body), color: color.dim, fontSize: '0.75rem' }}>
                    {entry.dateUtc === today ? 'Today' : entry.dateUtc} · {entry.runCount} run
                    {entry.runCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div
                style={{
                  ...typeStyle(ui.label),
                  color: color.blue,
                  fontSize: '0.85rem',
                }}
              >
                👥 {entry.bestCrowd}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
