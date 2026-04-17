/**
 * Title screen — the landing surface when the app boots. Sits on top of
 * the 3D canvas (which is already rendering the live cockpit+track scene
 * beneath), so clicking "DRIVE" just fades the overlay away and drops the
 * player directly into the cockpit view.
 *
 * Brand voice: "Midway Mayhem — Clown Car Chaos". Big-top carnival vibes,
 * polka-dot motif, "DRIVE FAST. HONK LOUDER." subtitle.
 *
 * The title screen supports a ?skip=1 URL flag that bypasses it entirely
 * (dev convenience + used by e2e playwright tests to skip into gameplay).
 */
import { useEffect, useState } from 'react';
import { loadTopScores, type ScoreRow } from '@/storage/scores';

interface TitleScreenProps {
  onDrive: () => void;
}

function shouldSkipFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('skip') === '1';
}

export function TitleScreen({ onDrive }: TitleScreenProps) {
  const [fading, setFading] = useState(false);
  const [scores, setScores] = useState<ScoreRow[]>([]);

  useEffect(() => {
    if (shouldSkipFromUrl()) onDrive();
  }, [onDrive]);

  useEffect(() => {
    void loadTopScores(5).then(setScores);
  }, []);

  const startFade = () => {
    if (fading) return;
    setFading(true);
    // Fade duration matches transition below; onDrive after so gameplay
    // begins as visual fade completes.
    setTimeout(onDrive, 400);
  };

  return (
    <div
      data-testid="title-screen"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(ellipse at center, rgba(156, 39, 176, 0.45) 0%, rgba(11, 15, 26, 0.92) 70%)',
        color: '#fff1db',
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        zIndex: 100,
        opacity: fading ? 0 : 1,
        transition: 'opacity 400ms ease-out',
        pointerEvents: fading ? 'none' : 'auto',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 'clamp(12px, 2vw, 16px)',
          letterSpacing: '0.4em',
          textTransform: 'uppercase',
          color: '#ffd600',
          marginBottom: '8px',
          opacity: 0.9,
        }}
      >
        Step Right Up
      </div>
      <h1
        style={{
          fontSize: 'clamp(42px, 9vw, 96px)',
          lineHeight: 0.95,
          margin: 0,
          fontWeight: 900,
          letterSpacing: '-0.02em',
          textShadow: '0 4px 16px rgba(156, 39, 176, 0.6), 0 0 32px rgba(255, 214, 0, 0.3)',
          color: '#fff1db',
        }}
      >
        MIDWAY
        <br />
        <span style={{ color: '#ff2d87' }}>MAYHEM</span>
      </h1>
      <div
        style={{
          marginTop: '14px',
          fontSize: 'clamp(14px, 2vw, 22px)',
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: '#ffd600',
        }}
      >
        Clown Car Chaos
      </div>
      <div
        style={{
          marginTop: '6px',
          fontSize: 'clamp(11px, 1.5vw, 16px)',
          fontWeight: 500,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'rgba(255, 241, 219, 0.7)',
        }}
      >
        Drive fast. Honk louder.
      </div>

      <button
        type="button"
        onClick={startFade}
        data-testid="title-drive-button"
        style={{
          marginTop: 'clamp(32px, 5vw, 56px)',
          padding: 'clamp(14px, 2vw, 20px) clamp(36px, 6vw, 64px)',
          fontSize: 'clamp(20px, 3vw, 32px)',
          fontWeight: 900,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#0b0f1a',
          background: '#ffd600',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          boxShadow: '0 6px 24px rgba(255, 214, 0, 0.35), 0 0 0 4px #ff2d87 inset',
          transition: 'transform 120ms ease, box-shadow 120ms ease',
        }}
        onPointerEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow =
            '0 10px 36px rgba(255, 214, 0, 0.55), 0 0 0 4px #ff2d87 inset';
        }}
        onPointerLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow =
            '0 6px 24px rgba(255, 214, 0, 0.35), 0 0 0 4px #ff2d87 inset';
        }}
      >
        Drive
      </button>

      {scores.length > 0 ? (
        <div
          data-testid="title-leaderboard"
          style={{
            marginTop: '32px',
            color: '#fff1db',
            fontSize: 'clamp(12px, 1.4vw, 15px)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          <div style={{ color: '#ffd600', marginBottom: '6px' }}>Top runs</div>
          {scores.map((s, i) => (
            <div key={`${s.timestamp}-${s.score}-${s.seed}`} style={{ lineHeight: 1.5 }}>
              #{i + 1} {Math.floor(s.score).toLocaleString()} · {s.balloons} 🎈
            </div>
          ))}
        </div>
      ) : null}

      <div
        style={{
          marginTop: '24px',
          fontSize: 'clamp(10px, 1.2vw, 13px)',
          color: 'rgba(255, 241, 219, 0.45)',
          letterSpacing: '0.08em',
        }}
      >
        an arcade cabinet original
      </div>
    </div>
  );
}
