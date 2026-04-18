import { useEffect, useRef, useState } from 'react';
import { BrandButton } from '@/design/components/BrandButton';
import { Dialog } from '@/design/components/Dialog';
import { color, space } from '@/design/tokens';
import { display, typeStyle, ui } from '@/design/typography';
import { reportError } from '@/game/errorBus';
import { getStats, type LifetimeStatsRow } from '@/persistence/lifetimeStats';

interface Props {
  onClose: () => void;
}

function formatDistance(cm: number): string {
  if (cm < 100_000) return `${(cm / 100).toFixed(0)} m`;
  return `${(cm / 100_000).toFixed(2)} km`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatMs(ms: number): string {
  const s = ms / 1000;
  return `${s.toFixed(2)}s`;
}

interface StatRow {
  label: string;
  value: string;
}

export function StatsPanel({ onClose }: Props) {
  const [stats, setStats] = useState<LifetimeStatsRow | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch((e) => reportError(e, 'StatsPanel.load'));
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lifetime: StatRow[] = stats
    ? [
        { label: 'Runs completed', value: stats.totalRunsCompleted.toLocaleString() },
        { label: 'Total distance', value: formatDistance(stats.totalDistanceCm) },
        { label: 'Seconds played', value: formatDuration(stats.secondsPlayed) },
        { label: 'Tickets earned', value: stats.totalTicketsEarned.toLocaleString() },
        { label: 'Crashes', value: stats.totalCrashes.toLocaleString() },
        { label: 'Critters scared', value: stats.totalScares.toLocaleString() },
      ]
    : [];

  const bests: StatRow[] = stats
    ? [
        { label: 'Longest combo chain', value: `×${stats.longestComboChain}` },
        { label: 'Best single-run crowd', value: stats.maxSingleRunCrowd.toLocaleString() },
        { label: 'Plunge-offs', value: stats.totalGameOversByPlunge.toLocaleString() },
        { label: 'Sanity wipes', value: stats.totalGameOversBySanity.toLocaleString() },
      ]
    : [];

  const zoneEntries = stats ? Object.entries(stats.bestZoneTimeMs) : [];

  return (
    <Dialog role="dialog" ariaLabel="Lifetime stats" testId="stats-panel" tone="info">
      <div style={{ maxWidth: 640, padding: space.xl, display: 'grid', gap: space.lg }}>
        <div style={{ ...typeStyle(display.banner), color: color.yellow }}>LIFETIME STATS</div>
        {!stats && <div style={{ ...typeStyle(ui.body), opacity: 0.7 }}>Loading…</div>}
        {stats && (
          <>
            <StatGrid label="TOTALS" rows={lifetime} />
            <StatGrid label="BESTS" rows={bests} />
            {zoneEntries.length > 0 && (
              <div>
                <div style={{ ...typeStyle(ui.label), color: color.blue, marginBottom: space.sm }}>
                  ZONE BEST TIMES
                </div>
                <table
                  style={{ width: '100%', borderCollapse: 'collapse', ...typeStyle(ui.body) }}
                  data-testid="stats-zone-table"
                >
                  <tbody>
                    {zoneEntries
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([zone, ms]) => (
                        <tr key={zone} style={{ borderTop: `1px solid ${color.white}20` }}>
                          <td style={{ padding: space.xs, color: color.yellow }}>{zone}</td>
                          <td style={{ padding: space.xs, textAlign: 'right' }}>{formatMs(ms)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <BrandButton
            ref={closeRef}
            kind="primary"
            size="md"
            onClick={onClose}
            testId="stats-close"
          >
            CLOSE
          </BrandButton>
        </div>
      </div>
    </Dialog>
  );
}

function StatGrid({ label, rows }: { label: string; rows: StatRow[] }) {
  return (
    <div>
      <div style={{ ...typeStyle(ui.label), color: color.blue, marginBottom: space.sm }}>
        {label}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: space.sm,
        }}
      >
        {rows.map((r) => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: space.xs,
              borderBottom: `1px solid ${color.white}15`,
              ...typeStyle(ui.body),
            }}
          >
            <span style={{ opacity: 0.8 }}>{r.label}</span>
            <span style={{ color: color.yellow, fontWeight: 700 }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
