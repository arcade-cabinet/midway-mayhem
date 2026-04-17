import { useGameStore } from '../systems/gameState';
import { audioBus } from '../systems/audioBus';

export function HUD() {
  const hype = useGameStore((s) => s.hype);
  const distance = useGameStore((s) => s.distance);
  const crashes = useGameStore((s) => s.crashes);
  const sanity = useGameStore((s) => s.sanity);
  const crowd = useGameStore((s) => s.crowdReaction);
  const gameOver = useGameStore((s) => s.gameOver);
  const startRun = useGameStore((s) => s.startRun);

  return (
    <div
      data-testid="hud"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        fontFamily: 'Rajdhani, sans-serif',
        color: '#fff',
        zIndex: 20,
      }}
    >
      <div data-testid="hud-hype" style={panelStyle('tl')}>
        <div style={labelStyle}>HYPE</div>
        <div style={valueStyle}>{hype.toFixed(0)}</div>
        <div style={barOuter}>
          <div style={{ ...barInner, width: `${Math.min(100, hype)}%`, background: '#FFD600' }} />
        </div>
      </div>

      <div data-testid="hud-stats" style={panelStyle('tr')}>
        <div style={labelStyle}>DISTANCE</div>
        <div style={valueStyle}>{distance.toFixed(0)}m</div>
        <div style={{ ...labelStyle, marginTop: 10 }}>CRASHES</div>
        <div style={valueStyle}>{crashes}</div>
      </div>

      <div data-testid="hud-sanity" style={panelStyle('bl')}>
        <div style={labelStyle}>SANITY</div>
        <div style={barOuter}>
          <div style={{ ...barInner, width: `${sanity}%`, background: '#E53935' }} />
        </div>
      </div>

      <div data-testid="hud-crowd" style={panelStyle('br')}>
        <div style={labelStyle}>CROWD</div>
        <div style={valueStyle}>{crowd.toFixed(0)}</div>
      </div>

      <button
        data-testid="honk-button"
        onClick={() => audioBus.playHonk()}
        style={{
          position: 'absolute',
          bottom: 'calc(20px + env(safe-area-inset-bottom, 0))',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'auto',
          padding: '16px 32px',
          border: '3px solid #ffd600',
          background: '#E53935',
          color: '#fff',
          fontFamily: 'Bangers, sans-serif',
          fontSize: '1.5rem',
          letterSpacing: '0.08em',
          borderRadius: 12,
          cursor: 'pointer',
        }}
        type="button"
      >
        HONK
      </button>

      {gameOver && (
        <div
          data-testid="game-over"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(11,15,26,0.8)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'Bangers, sans-serif',
                fontSize: 'clamp(3rem, 10vw, 6rem)',
                color: '#E53935',
                letterSpacing: '0.08em',
              }}
            >
              CROWD LOST IT!
            </div>
            <div style={{ marginTop: 12, fontSize: '1.4rem' }}>Distance: {distance.toFixed(0)}m</div>
            <div style={{ fontSize: '1.4rem' }}>Crowd Reaction: {crowd.toFixed(0)}</div>
            <button
              data-testid="restart-button"
              type="button"
              onClick={() => startRun()}
              style={{
                marginTop: 24,
                padding: '16px 32px',
                background: '#ffd600',
                color: '#0b0f1a',
                border: 'none',
                fontFamily: 'Bangers, sans-serif',
                fontSize: '1.8rem',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                borderRadius: 12,
              }}
            >
              AGAIN!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const panelStyle = (corner: 'tl' | 'tr' | 'bl' | 'br'): React.CSSProperties => ({
  position: 'absolute',
  padding: 16,
  background: 'rgba(11,15,26,0.6)',
  border: '2px solid rgba(255,214,0,0.4)',
  borderRadius: 10,
  backdropFilter: 'blur(6px)',
  minWidth: 140,
  ...(corner.includes('t') ? { top: 'calc(20px + env(safe-area-inset-top, 0))' } : { bottom: 'calc(120px + env(safe-area-inset-bottom, 0))' }),
  ...(corner.includes('l') ? { left: 20 } : { right: 20 }),
});
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.15em',
  color: '#1E88E5',
  fontWeight: 700,
};
const valueStyle: React.CSSProperties = {
  fontFamily: 'Bangers, sans-serif',
  fontSize: '2rem',
  color: '#FFD600',
  lineHeight: 1,
};
const barOuter: React.CSSProperties = {
  marginTop: 6,
  width: '100%',
  height: 8,
  background: 'rgba(255,255,255,0.1)',
  borderRadius: 4,
  overflow: 'hidden',
};
const barInner: React.CSSProperties = { height: '100%', transition: 'width 0.2s ease' };
