/**
 * PhotoMode — post-game-over screenshot overlay.
 *
 * Renders when gameOver=true and photoMode=true (set by GameOverOverlay's
 * "📸 PHOTO" button).  Shows:
 *   - OrbitControls on a secondary camera for free look
 *   - Download PNG button (renderer.domElement.toDataURL → <a> click)
 *   - Dismiss button (returns to GameOverOverlay)
 *
 * GameLoop is paused while photoMode=true via the photoMode flag in gameState.
 *
 * NOTE: setPhotoMode is wired to game/gameState — that store is owned by the
 * game-state agent. Until it lands, PhotoModeOverlay accepts an onDismiss
 * callback instead of reading from useGameStore directly.
 */

import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { color, elevation, radius, safeArea, space } from '@/design/tokens';
import { display, typeStyle } from '@/design/typography';
import { reportError } from '@/game/errorBus';

/** R3F sub-component that renders OrbitControls into the canvas. */
export function PhotoModeControls() {
  return <OrbitControls makeDefault enableDamping dampingFactor={0.12} />;
}

/** R3F sub-component for PNG download — needs access to the renderer. */
export function PhotoModeDownloadCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const { gl } = useThree();

  const capture = () => {
    // Render one more frame to ensure the canvas is current
    const dataUrl = gl.domElement.toDataURL('image/png');
    onCapture(dataUrl);
  };

  // Expose the capture function so the HUD layer can call it
  // biome-ignore lint/suspicious/noExplicitAny: dev hook
  (window as any).__mmPhotoCapture = capture;

  return null;
}

/** HUD overlay layer for photo mode — renders OUTSIDE the canvas. */
export function PhotoModeOverlay({ onDismiss }: { onDismiss: () => void }) {
  const downloadRef = useRef<HTMLButtonElement | null>(null);

  // Focus download button on mount
  useEffect(() => {
    downloadRef.current?.focus();
  }, []);

  // Esc dismisses photo mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const handleDownload = () => {
    // biome-ignore lint/suspicious/noExplicitAny: dev hook
    const capture = (window as any).__mmPhotoCapture as (() => void) | undefined;
    if (!capture) {
      reportError(
        new Error('Photo capture hook (__mmPhotoCapture) is not registered.'),
        'PhotoMode.handleDownload',
      );
      return;
    }
    capture();
  };

  const handleDismiss = () => {
    onDismiss();
    // biome-ignore lint/suspicious/noExplicitAny: dev hook
    (window as any).__mmPhotoCapture = undefined;
  };

  return (
    <div
      data-testid="photo-mode-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: `calc(${space.xxl}px + ${safeArea.bottom})`,
        gap: space.md,
      }}
    >
      {/* Label */}
      <div
        style={{
          ...typeStyle(display.button),
          color: color.yellow,
          textShadow: `0 0 12px ${color.yellow}`,
          fontSize: '1rem',
          letterSpacing: '0.12em',
          marginBottom: space.sm,
        }}
      >
        PHOTO MODE — drag to orbit
      </div>

      <div
        style={{
          display: 'flex',
          gap: space.md,
        }}
      >
        <button
          ref={downloadRef}
          data-testid="photo-download-btn"
          type="button"
          onClick={handleDownload}
          style={{
            padding: `${space.md}px ${space.xl}px`,
            background: color.yellow,
            color: color.night,
            border: 'none',
            borderRadius: radius.md,
            ...typeStyle(display.button),
            fontSize: '1.1rem',
            cursor: 'pointer',
            boxShadow: elevation.glow,
          }}
        >
          📸 SAVE PNG
        </button>

        <button
          data-testid="photo-dismiss-btn"
          type="button"
          onClick={handleDismiss}
          style={{
            padding: `${space.md}px ${space.xl}px`,
            background: 'transparent',
            color: color.white,
            border: `2px solid ${color.borderSubtle}`,
            borderRadius: radius.md,
            ...typeStyle(display.button),
            fontSize: '1.1rem',
            cursor: 'pointer',
          }}
        >
          BACK
        </button>
      </div>
    </div>
  );
}

export { triggerDownload } from './photoUtils';
