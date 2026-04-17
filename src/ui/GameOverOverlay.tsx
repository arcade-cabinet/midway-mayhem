/**
 * Game-over overlay — shows after a run ends. "RUN COMPLETE" for finish,
 * "WIPEOUT" for 3-damage end. Restart button reloads the page (simplest
 * possible reset; preserves determinism of the first-paint seed).
 */

interface GameOverProps {
  reason: 'damage' | 'finish' | null;
  score: number;
  balloons: number;
  onRestart: () => void;
}

export function GameOverOverlay({ reason, score, balloons, onRestart }: GameOverProps) {
  if (!reason) return null;
  const title = reason === 'finish' ? 'RUN COMPLETE' : 'WIPEOUT';
  const titleColor = reason === 'finish' ? '#ffd600' : '#ff2d87';

  return (
    <div
      data-testid="game-over"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(ellipse at center, rgba(11, 15, 26, 0.82) 0%, rgba(11, 15, 26, 0.96) 70%)',
        color: '#fff1db',
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        zIndex: 50,
        textAlign: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          fontSize: 'clamp(42px, 8vw, 96px)',
          fontWeight: 900,
          letterSpacing: '0.02em',
          color: titleColor,
          textShadow: `0 4px 24px ${titleColor}88`,
          lineHeight: 1,
          marginBottom: '16px',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 'clamp(24px, 3.5vw, 42px)',
          color: '#fff1db',
          letterSpacing: '0.08em',
          marginBottom: '8px',
        }}
      >
        SCORE {Math.floor(score).toLocaleString()}
      </div>
      <div
        style={{
          fontSize: 'clamp(14px, 1.8vw, 20px)',
          color: '#ffd600',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: '40px',
        }}
      >
        {balloons} balloons popped
      </div>
      <button
        type="button"
        onClick={onRestart}
        data-testid="game-over-restart"
        style={{
          padding: 'clamp(12px, 2vw, 18px) clamp(32px, 5vw, 56px)',
          fontSize: 'clamp(18px, 2.6vw, 28px)',
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
        Run it back
      </button>
    </div>
  );
}
