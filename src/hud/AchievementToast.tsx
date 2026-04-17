/**
 * @component AchievementToast
 *
 * Listens to achievementBus and queues slide-in banners for newly-earned
 * achievements. Multiple unlocks in one run stack sequentially (3 s each).
 */

import { useEffect, useState } from 'react';
import { Panel } from '@/design/components/Panel';
import { color, motion, radius, space, zLayer } from '@/design/tokens';
import { ui, typeStyle } from '@/design/typography';
import { type AchievementGrantedEvent, subscribeAchievements } from '@/game/achievementBus';

interface QueuedToast extends AchievementGrantedEvent {
  id: number;
}

let _toastId = 0;

const TOAST_DURATION_MS = 3000;

export function AchievementToast() {
  const [queue, setQueue] = useState<QueuedToast[]>([]);
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<QueuedToast | null>(null);

  // Subscribe to achievement bus
  useEffect(() => {
    return subscribeAchievements((event) => {
      setQueue((q) => [...q, { ...event, id: ++_toastId }]);
    });
  }, []);

  // Dequeue and display one at a time
  useEffect(() => {
    if (current !== null || queue.length === 0) return;

    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next ?? null);
    setVisible(false);

    // Slight delay so the slide-in animation fires on mount
    const enterTimer = setTimeout(() => setVisible(true), 16);
    const exitTimer = setTimeout(() => setVisible(false), TOAST_DURATION_MS - 400);
    const clearTimer = setTimeout(() => setCurrent(null), TOAST_DURATION_MS);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(clearTimer);
    };
  }, [current, queue]);

  if (!current) return null;

  return (
    <div
      data-testid="achievement-toast"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 80,
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? 0 : -24}px)`,
        opacity: visible ? 1 : 0,
        transition: `opacity ${motion.base}ms ${motion.easing.out}, transform ${motion.base}ms ${motion.easing.out}`,
        zIndex: zLayer.dialog + 10,
        pointerEvents: 'none',
        minWidth: 280,
        maxWidth: 400,
      }}
    >
      <Panel
        variant="elevated"
        style={{
          border: `2px solid ${color.borderSuccess}`,
          display: 'flex',
          alignItems: 'center',
          gap: space.md,
          padding: `${space.sm}px ${space.base}px`,
          borderRadius: radius.lg,
        }}
      >
        {/* Star icon */}
        <div
          aria-hidden="true"
          style={{
            fontSize: '1.5rem',
            lineHeight: 1,
            filter: `drop-shadow(0 0 8px ${color.yellow})`,
          }}
        >
          ★
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              ...typeStyle(ui.label),
              color: color.yellow,
              fontSize: '0.7rem',
              letterSpacing: '0.12em',
              marginBottom: 2,
            }}
          >
            ACHIEVEMENT UNLOCKED
          </div>
          <div
            style={{
              ...typeStyle(ui.body),
              color: color.white,
              fontWeight: 700,
              fontSize: '0.95rem',
            }}
          >
            {current.title}
          </div>
        </div>
      </Panel>
    </div>
  );
}
