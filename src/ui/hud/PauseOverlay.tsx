/**
 * Pause overlay — shown when the run is paused (RunSession.paused).
 *
 * Mounts a fullscreen backdrop with a big "PAUSED" title and a RESUME
 * button. Clicking RESUME resumes the run. The overlay reads from
 * gameState's `paused` flag so Esc/P keyboard and the mobile pause
 * button all trigger the same UI.
 */
import { resume, useGameStore } from '@/game/gameState';

export function PauseOverlay() {
  const paused = useGameStore((s) => s.paused);
  const running = useGameStore((s) => s.running);
  const gameOver = useGameStore((s) => s.gameOver);

  if (!paused || !running || gameOver) return null;

  return (
    <div
      data-testid="pause-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(ellipse at center, rgba(11, 15, 26, 0.55) 0%, rgba(11, 15, 26, 0.8) 85%)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        color: '#fff1db',
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        zIndex: 45,
        textAlign: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          fontSize: 'clamp(48px, 10vw, 128px)',
          fontWeight: 900,
          letterSpacing: '0.06em',
          color: '#ffd600',
          textShadow: '0 4px 24px #ffd60088',
          lineHeight: 1,
          marginBottom: '32px',
        }}
      >
        PAUSED
      </div>
      <button
        type="button"
        onClick={() => resume()}
        data-testid="pause-resume"
        style={{
          padding: 'clamp(12px, 2vw, 18px) clamp(32px, 5vw, 56px)',
          fontSize: 'clamp(20px, 2.8vw, 32px)',
          fontWeight: 900,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#0b0f1a',
          background: '#ffd600',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          boxShadow: '0 6px 24px rgba(255, 214, 0, 0.35), 0 0 0 4px #ff2d87 inset',
        }}
      >
        Resume
      </button>
      <div
        style={{
          marginTop: '18px',
          fontSize: 'clamp(12px, 1.3vw, 16px)',
          color: '#a8a8b0',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        ESC or P to resume
      </div>
    </div>
  );
}
