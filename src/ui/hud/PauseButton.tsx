/**
 * Pause button — always-visible small button in the top-right safe area.
 * Clicking triggers the pause() action, which flips RunSession.paused;
 * PauseOverlay picks up the change and mounts. Hidden when the run isn't
 * active.
 */
import { pause, useGameStore } from '@/game/gameState';

export function PauseButton() {
  const running = useGameStore((s) => s.running);
  const paused = useGameStore((s) => s.paused);
  const gameOver = useGameStore((s) => s.gameOver);

  // Hide while the run hasn't started, is already paused, or is over.
  if (!running || paused || gameOver) return null;

  return (
    <button
      type="button"
      onClick={() => pause()}
      data-testid="pause-button"
      aria-label="Pause"
      style={{
        position: 'fixed',
        top: 'calc(12px + env(safe-area-inset-top, 0px))',
        right: 'calc(104px + env(safe-area-inset-right, 0px))',
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        border: '2px solid rgba(255, 214, 0, 0.6)',
        borderRadius: 8,
        background: 'rgba(11, 15, 26, 0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        cursor: 'pointer',
        color: '#ffd600',
        fontSize: 18,
        fontWeight: 900,
        letterSpacing: 2,
        zIndex: 40,
        lineHeight: 1,
      }}
    >
      ‖‖
    </button>
  );
}
