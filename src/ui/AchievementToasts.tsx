/**
 * Achievement toast layer — subscribes to the achievement bus and
 * renders a stack of sliding toasts at the top of the screen. Each toast
 * auto-dismisses after ~2.5s; title + detail come from the Achievement
 * definition.
 */
import { useEffect, useState } from 'react';
import { type Achievement, onAchievement } from '@/game/achievements';

interface Toast {
  key: number;
  ach: Achievement;
}

export function AchievementToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let counter = 0;
    return onAchievement((ach) => {
      const key = ++counter;
      setToasts((prev) => [...prev, { key, ach }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.key !== key));
      }, 2500);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="achievement-toasts"
      style={{
        position: 'fixed',
        top: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 80,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.key}
          style={{
            background:
              'linear-gradient(135deg, rgba(156, 39, 176, 0.92) 0%, rgba(11, 15, 26, 0.92) 100%)',
            color: '#fff1db',
            padding: '14px 28px',
            borderRadius: '8px',
            border: '2px solid #ffd600',
            boxShadow: '0 8px 32px rgba(255, 214, 0, 0.35)',
            fontFamily: '"Helvetica Neue", Arial, sans-serif',
            minWidth: '260px',
            animation: 'toast-slide 2500ms ease-in-out',
          }}
        >
          <div
            style={{
              fontSize: 'clamp(10px, 1.1vw, 12px)',
              letterSpacing: '0.3em',
              color: '#ffd600',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}
          >
            Achievement
          </div>
          <div
            style={{
              fontSize: 'clamp(18px, 2.2vw, 24px)',
              fontWeight: 900,
              letterSpacing: '0.05em',
              lineHeight: 1.1,
            }}
          >
            {t.ach.title}
          </div>
          <div
            style={{
              fontSize: 'clamp(11px, 1.3vw, 14px)',
              color: 'rgba(255, 241, 219, 0.75)',
              marginTop: '4px',
            }}
          >
            {t.ach.detail}
          </div>
        </div>
      ))}
      <style>
        {`@keyframes toast-slide {
          0% { opacity: 0; transform: translateY(-20px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-10px); }
        }`}
      </style>
    </div>
  );
}
