/**
 * CutsceneBalloons — Balloon Alley cutscene.
 *
 * Two parts:
 *   BalloonScene3D — R3F component rendered inside <Canvas>. Balloons float up.
 *   CutsceneBalloons — HTML overlay (rendered outside Canvas). Text + dismiss button.
 *
 * Both are driven by shared progress via a zustand atom-like shared ref. The
 * progress is driven by rAF inside the HTML overlay component.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { triggerSlideWhistle } from '@/audio/sfx';
import { color, space } from '@/design/tokens';
import { display, typeStyle } from '@/design/typography';

const DURATION = 5.0;
const BALLOON_COUNT = 12;
const BALLOON_COLORS = [0xe53935, 0xffd600, 0x1e88e5, 0x8e24aa, 0xf36f21];

interface BalloonLayout {
  x: number;
  z: number;
  color: number;
  phase: number;
}

const BALLOON_LAYOUT: BalloonLayout[] = Array.from({ length: BALLOON_COUNT }, (_, i) => ({
  x: (i % 4) * 3 - 4.5,
  z: Math.floor(i / 4) * 2 - 2,
  color: BALLOON_COLORS[i % BALLOON_COLORS.length] ?? 0xffd600,
  phase: i * 0.4,
}));

/** R3F component — mount INSIDE Canvas */
export function BalloonScene3D({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  return (
    <>
      {BALLOON_LAYOUT.map((b) => (
        <BalloonMesh key={`${b.x},${b.z},${b.phase}`} layout={b} progressRef={progressRef} />
      ))}
    </>
  );
}

function BalloonMesh({
  layout,
  progressRef,
}: {
  layout: BalloonLayout;
  progressRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geo = useRef(new THREE.SphereGeometry(0.45, 8, 6));
  const mat = useRef(
    new THREE.MeshStandardMaterial({ color: layout.color, metalness: 0.3, roughness: 0.2 }),
  );

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    const p = progressRef.current;
    const rise = p * 8 + Math.sin(t * 1.5 + layout.phase) * 0.2;
    meshRef.current.position.set(
      layout.x + Math.sin(t * 0.8 + layout.phase) * 0.15,
      1.7 + rise,
      layout.z - 4,
    );
  });

  return <mesh ref={meshRef} geometry={geo.current} material={mat.current} />;
}

/** HTML overlay — mount OUTSIDE Canvas */
export function CutsceneBalloons({ onDismiss }: { onDismiss: () => void }) {
  const startRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const dismissedRef = useRef(false);
  const audioFired = useRef(false);

  useEffect(() => {
    if (!audioFired.current) {
      audioFired.current = true;
      try {
        triggerSlideWhistle('up');
      } catch {
        /* audio may not be ready */
      }
    }
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000;
      const p = Math.min(1, elapsed / DURATION);
      progressRef.current = p;
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else if (!dismissedRef.current) {
        dismissedRef.current = true;
        onDismiss();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDismiss]);

  return (
    <div
      data-testid="cutscene-balloons"
      style={{
        position: 'absolute',
        top: '15%',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      <div
        style={{
          ...typeStyle(display.banner),
          color: color.yellow,
          textShadow: `3px 3px 0 ${color.purple}`,
          opacity: Math.min(1, progress * 3),
        }}
      >
        BALLOON ALLEY
      </div>
      <div
        style={{
          ...typeStyle(display.tag),
          color: color.white,
          marginTop: space.sm,
          opacity: Math.min(1, progress * 2),
        }}
      >
        Watch them soar!
      </div>
      <button
        type="button"
        style={{
          marginTop: space.xl,
          padding: `${space.sm}px ${space.xl}px`,
          background: color.purple,
          border: `2px solid ${color.yellow}`,
          color: color.white,
          borderRadius: 8,
          cursor: 'pointer',
          ...typeStyle(display.button),
          pointerEvents: 'auto',
        }}
        onClick={onDismiss}
      >
        DISMISS
      </button>
    </div>
  );
}

/** Returns a progressRef to share between BalloonScene3D and CutsceneBalloons */
export function useBalloonProgress(): React.MutableRefObject<number> {
  return useRef(0);
}
