/**
 * CutsceneFunhouse — Funhouse cutscene.
 *
 * FunhouseScene3D — R3F component rendered inside <Canvas>. Mirror-walls wave.
 * CutsceneFunhouse — HTML overlay rendered outside Canvas. Warping text + dismiss.
 *
 * Progress driven by rAF in the HTML overlay; shared via ref.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { color, space } from '../design/tokens';
import { display, typeStyle } from '../design/typography';
import { triggerCrashRoll } from '../systems/audio/sfx';

const DURATION = 5.0;

const _planeGeo = new THREE.PlaneGeometry(4, 5);
const _mirrorMat = new THREE.MeshStandardMaterial({
  color: 0x8888ff,
  metalness: 0.95,
  roughness: 0.02,
  envMapIntensity: 2.0,
});

/** R3F component — mount INSIDE Canvas */
export function FunhouseScene3D({
  progressRef,
}: {
  progressRef: React.MutableRefObject<number>;
}) {
  const leftRef = useRef<THREE.Mesh>(null);
  const rightRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const wave = Math.sin(t * 2) * progressRef.current * 0.4;
    if (leftRef.current) {
      leftRef.current.rotation.y = Math.PI / 3 + wave;
      leftRef.current.position.x = -5 + wave;
    }
    if (rightRef.current) {
      rightRef.current.rotation.y = -Math.PI / 3 - wave;
      rightRef.current.position.x = 5 - wave;
    }
  });

  return (
    <>
      <mesh
        ref={leftRef}
        geometry={_planeGeo}
        material={_mirrorMat}
        position={[-5, 2.5, -5]}
      />
      <mesh
        ref={rightRef}
        geometry={_planeGeo}
        material={_mirrorMat}
        position={[5, 2.5, -5]}
      />
    </>
  );
}

/** HTML overlay — mount OUTSIDE Canvas */
export function CutsceneFunhouse({ onDismiss }: { onDismiss: () => void }) {
  const startRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const dismissedRef = useRef(false);
  const audioFired = useRef(false);

  useEffect(() => {
    if (!audioFired.current) {
      audioFired.current = true;
      try {
        triggerCrashRoll();
        setTimeout(() => { try { triggerCrashRoll(); } catch { /* ok */ } }, 300);
        setTimeout(() => { try { triggerCrashRoll(); } catch { /* ok */ } }, 600);
      } catch { /* audio may not be ready */ }
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

  const warp = Math.sin(progress * Math.PI) * 24;

  return (
    <div
      data-testid="cutscene-funhouse"
      style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: `translateX(-50%) skewX(${warp}deg)`,
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      <div
        style={{
          ...typeStyle(display.banner),
          color: color.purple,
          textShadow: `${warp * 0.3}px 3px 0 ${color.blue}`,
          filter: `hue-rotate(${warp * 4}deg)`,
          opacity: Math.min(1, progress * 3),
        }}
      >
        FUNHOUSE FRENZY
      </div>
      <div
        style={{
          ...typeStyle(display.tag),
          color: color.yellow,
          marginTop: space.sm,
          transform: `scaleX(${1 + Math.sin(progress * Math.PI * 2) * 0.4})`,
          opacity: Math.min(1, progress * 2),
        }}
      >
        HA HA HA HA HA!
      </div>
      <button
        type="button"
        style={{
          marginTop: space.xl,
          padding: `${space.sm}px ${space.xl}px`,
          background: color.purple,
          border: `2px solid ${color.blue}`,
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

export function useFunhouseProgress(): React.MutableRefObject<number> {
  return useRef(0);
}
