import { BrandButton } from '../design/components/BrandButton';
import { color, space } from '../design/tokens';
import { display, typeStyle, ui } from '../design/typography';
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
        background: `radial-gradient(ellipse at center, ${color.purple}33 0%, ${color.night} 70%), ${color.night}`,
        overflow: 'hidden',
      }}
    >
      <ConfettiBG />
      <div style={{ textAlign: 'center', zIndex: 2, padding: space.xxl }}>
        <div
          style={{
            ...typeStyle(display.hero),
            color: color.yellow,
            textShadow: `6px 6px 0 ${color.red}, 12px 12px 0 ${color.blue}`,
            transform: 'skewX(-4deg)',
          }}
        >
          MIDWAY
          <br />
          MAYHEM
        </div>
        <div
          style={{
            ...typeStyle(ui.label),
            fontSize: '1.3rem',
            marginTop: space.sm,
            color: color.blue,
          }}
        >
          CLOWN CAR CHAOS
        </div>
        <div
          style={{
            ...typeStyle(ui.body),
            marginTop: space.xl,
            fontSize: '1.1rem',
            letterSpacing: '0.18em',
            color: color.white,
            opacity: 0.85,
          }}
        >
          DRIVE FAST. HONK LOUDER.
        </div>
        <div style={{ marginTop: space.xxxl }}>
          <BrandButton
            kind="primary"
            size="lg"
            onClick={() => {
              initAudioBusSafely();
              onStart();
            }}
            testId="start-button"
          >
            START
          </BrandButton>
        </div>
      </div>
    </div>
  );
}

function ConfettiBG() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: `radial-gradient(circle at 20% 30%, ${color.red}40 0 8px, transparent 9px), radial-gradient(circle at 80% 70%, ${color.blue}40 0 8px, transparent 9px), radial-gradient(circle at 50% 50%, ${color.purple}40 0 6px, transparent 7px)`,
        backgroundSize: '80px 80px, 100px 100px, 120px 120px',
        opacity: 0.5,
      }}
    />
  );
}
