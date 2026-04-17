import { initAudioBusSafely } from '../systems/audioBus';

export function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div
      data-testid="title-screen"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(ellipse at center, #2a0d3d 0%, #0b0f1a 70%), #0b0f1a',
        overflow: 'hidden',
      }}
    >
      <ConfettiBG />
      <div style={{ textAlign: 'center', zIndex: 2, padding: 32 }}>
        <div
          style={{
            fontFamily: 'Bangers, Impact, sans-serif',
            fontSize: 'clamp(3rem, 14vw, 7.5rem)',
            lineHeight: 0.95,
            color: '#FFD600',
            textShadow: '6px 6px 0 #E53935, 12px 12px 0 #1E88E5',
            letterSpacing: '0.05em',
            transform: 'skewX(-4deg)',
          }}
        >
          MIDWAY
          <br />
          MAYHEM
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '1.3rem',
            letterSpacing: '0.2em',
            color: '#1E88E5',
            fontWeight: 700,
          }}
        >
          CLOWN CAR CHAOS
        </div>
        <div
          style={{
            marginTop: 24,
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '1.1rem',
            letterSpacing: '0.18em',
            color: '#fff',
            opacity: 0.85,
          }}
        >
          DRIVE FAST. HONK LOUDER.
        </div>
        <button
          data-testid="start-button"
          type="button"
          onClick={() => {
            initAudioBusSafely();
            onStart();
          }}
          style={{
            marginTop: 40,
            padding: '18px 48px',
            background: '#E53935',
            border: '4px solid #FFD600',
            color: '#fff',
            fontFamily: 'Bangers, sans-serif',
            fontSize: '2rem',
            letterSpacing: '0.1em',
            cursor: 'pointer',
            borderRadius: 16,
            boxShadow: '0 0 32px rgba(255,214,0,0.4)',
          }}
        >
          START
        </button>
      </div>
    </div>
  );
}

function ConfettiBG() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage:
          'radial-gradient(circle at 20% 30%, #E5393540 0 8px, transparent 9px), radial-gradient(circle at 80% 70%, #1E88E540 0 8px, transparent 9px), radial-gradient(circle at 50% 50%, #8E24AA40 0 6px, transparent 7px)',
        backgroundSize: '80px 80px, 100px 100px, 120px 120px',
        opacity: 0.5,
      }}
    />
  );
}
