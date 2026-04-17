import { useEffect, useRef } from 'react';
import { BrandButton } from '@/design/components/BrandButton';
import { color, space } from '@/design/tokens';
import { display, typeStyle, ui } from '@/design/typography';
import { useGameStore } from '@/game/gameState';

interface GameOverOverlayProps {
  distance: number;
  crowd: number;
  onRestart: () => void;
}

export function GameOverOverlay({ distance, crowd, onRestart }: GameOverOverlayProps) {
  const setPhotoMode = useGameStore((s) => s.setPhotoMode);
  const restartRef = useRef<HTMLButtonElement | null>(null);

  // Focus RESTART button on mount so keyboard users can press Enter immediately
  useEffect(() => {
    restartRef.current?.focus();
  }, []);

  return (
    <div
      data-testid="game-over"
      role="dialog"
      aria-modal="true"
      aria-label="Game Over"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: color.overlayDim,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ textAlign: 'center', padding: space.xl }}>
        <div
          style={{
            ...typeStyle(display.hero),
            color: color.red,
            fontSize: 'clamp(3rem, 10vw, 6rem)',
          }}
        >
          CROWD LOST IT!
        </div>
        <div
          style={{
            ...typeStyle(ui.body),
            marginTop: space.md,
            fontSize: '1.2rem',
            color: color.white,
          }}
        >
          Distance: {distance.toFixed(0)}m
        </div>
        <div
          style={{
            ...typeStyle(ui.body),
            fontSize: '1.2rem',
            color: color.white,
          }}
        >
          Crowd Reaction: {crowd.toFixed(0)}
        </div>
        <div
          style={{
            marginTop: space.xl,
            display: 'flex',
            gap: space.md,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <BrandButton
            ref={restartRef}
            kind="primary"
            size="lg"
            onClick={onRestart}
            testId="restart-button"
          >
            AGAIN!
          </BrandButton>
          <BrandButton
            kind="secondary"
            size="lg"
            onClick={() => setPhotoMode(true)}
            testId="photo-mode-button"
          >
            📸 PHOTO
          </BrandButton>
        </div>
      </div>
    </div>
  );
}
