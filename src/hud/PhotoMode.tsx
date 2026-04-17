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
 */

import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { color, elevation, radius, safeArea, space } from '@/design/tokens';
import { display, typeStyle } from '@/design/typography';
import { useGameStore } from '@/game/gameState';

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

function buildFilename(): string {
  const d = new Date();
  const YYYY = d.getFullYear();
  const MM = padTwo(d.getMonth() + 1);
  const DD = padTwo(d.getDate());
  const hh = padTwo(d.getHours());
  const mm = padTwo(d.getMinutes());
  const ss = padTwo(d.getSeconds());
  return `midway-mayhem-${YYYY}${MM}${DD}-${hh}${mm}${ss}.png`;
}

/** R3F sub-component that renders OrbitControls into the canvas. */
export function PhotoModeControls() {
  return <OrbitControls makeDefault enableDamping dampingFactor={0.12} />;
}

/** R3F sub-component for PNG download — needs access to the renderer. */
export function PhotoModeDownloadCapture({
  onCapture,
}: {
  onCapture: (dataUrl: string) => void;
}) {
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
export function PhotoModeOverlay() {
  const setPhotoMode = useGameStore((s) => s.setPhotoMode);

  const handleDownload = () => {
    // biome-ignore lint/suspicious/noExplicitAny: dev hook
    const capture = (window as any).__mmPhotoCapture as (() => void) | undefined;
    if (capture) {
      capture();
    } else {
      // Fallback: try canvas directly if hook not wired
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png');
      triggerDownload(dataUrl);
    }
  };

  const handleDismiss = () => {
    setPhotoMode(false);
    // biome-ignore lint/suspicious/noExplicitAny: dev hook
    delete (window as any).__mmPhotoCapture;
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

/** Trigger a browser download from a dataURL. */
export function triggerDownload(dataUrl: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = buildFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
