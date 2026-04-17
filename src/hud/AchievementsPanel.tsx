/**
 * @component AchievementsPanel
 *
 * Full achievement list shown from the title screen.
 * Locked achievements are grayscale; unlocked show color + date;
 * in-progress show a progress bar.
 */

import { useEffect, useRef, useState } from 'react';
import { BrandButton } from '@/design/components/BrandButton';
import { Dialog } from '@/design/components/Dialog';
import { GaugeBar } from '@/design/components/GaugeBar';
import { Panel } from '@/design/components/Panel';
import { color, radius, space } from '@/design/tokens';
import { typeStyle, ui } from '@/design/typography';
import { type AchievementStatus, listAll } from '@/persistence/achievements';
import { initDb } from '@/persistence/db';

interface Props {
  onClose: () => void;
}

export function AchievementsPanel({ onClose }: Props) {
  const [achievements, setAchievements] = useState<AchievementStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    initDb()
      .then(() => listAll())
      .then((list) => {
        setAchievements(list);
        setLoading(false);
      });
  }, []);

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Esc closes the panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const unlocked = achievements.filter((a) => a.unlockedAt !== null).length;

  return (
    <Dialog tone="info" testId="achievements-panel" role="dialog" ariaLabel="Achievements">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: space.lg,
        }}
      >
        <div>
          <div
            style={{
              ...typeStyle(ui.label),
              color: color.yellow,
              fontSize: '1.2rem',
              letterSpacing: '0.15em',
            }}
          >
            ACHIEVEMENTS
          </div>
          {!loading && (
            <div style={{ ...typeStyle(ui.body), color: color.dim, fontSize: '0.85rem' }}>
              {unlocked} / {achievements.length} unlocked
            </div>
          )}
        </div>
        <BrandButton
          ref={closeButtonRef}
          kind="ghost"
          size="sm"
          onClick={onClose}
          testId="achievements-close"
        >
          CLOSE
        </BrandButton>
      </div>

      {loading ? (
        <div
          style={{
            ...typeStyle(ui.body),
            color: color.dim,
            padding: space.xl,
            textAlign: 'center',
          }}
        >
          Loading…
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: space.md,
            maxHeight: '60vh',
            overflowY: 'auto',
          }}
        >
          {achievements.map((a) => (
            <AchievementCard key={a.slug} achievement={a} />
          ))}
        </div>
      )}
    </Dialog>
  );
}

function AchievementCard({ achievement: a }: { achievement: AchievementStatus }) {
  const unlocked = a.unlockedAt !== null;
  const progress = a.targetValue > 1 ? (a.progressValue / a.targetValue) * 100 : 0;
  const showBar = a.targetValue > 1 && !unlocked;

  const dateStr =
    unlocked && a.unlockedAt
      ? new Date(a.unlockedAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

  return (
    <Panel
      variant="dark"
      style={{
        opacity: unlocked ? 1 : 0.55,
        filter: unlocked ? 'none' : 'grayscale(0.8)',
        border: unlocked ? `2px solid ${color.borderSuccess}` : `2px solid ${color.borderSubtle}`,
        borderRadius: radius.md,
        padding: space.base,
        transition: 'opacity 0.2s, filter 0.2s',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.xs }}>
        <span
          aria-hidden="true"
          style={{
            fontSize: '1.1rem',
            filter: unlocked ? `drop-shadow(0 0 6px ${color.yellow})` : 'none',
          }}
        >
          {unlocked ? '★' : '☆'}
        </span>
        <div
          style={{
            ...typeStyle(ui.body),
            fontWeight: 700,
            color: unlocked ? color.white : color.dim,
            fontSize: '0.9rem',
          }}
        >
          {a.title}
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          ...typeStyle(ui.body),
          color: color.dim,
          fontSize: '0.8rem',
          marginBottom: showBar || dateStr ? space.xs : 0,
        }}
      >
        {a.description}
      </div>

      {/* Progress bar */}
      {showBar && (
        <div style={{ marginTop: space.xs }}>
          <GaugeBar value={progress} tone="blue" height={6} />
          <div
            style={{ ...typeStyle(ui.body), color: color.dim, fontSize: '0.75rem', marginTop: 2 }}
          >
            {a.progressValue} / {a.targetValue}
          </div>
        </div>
      )}

      {/* Unlock date */}
      {dateStr && (
        <div
          style={{
            ...typeStyle(ui.body),
            color: color.toneSuccess,
            fontSize: '0.75rem',
            marginTop: space.xs,
          }}
        >
          Unlocked {dateStr}
        </div>
      )}
    </Panel>
  );
}
