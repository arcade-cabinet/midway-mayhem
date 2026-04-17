/**
 * CutsceneFire — Ring of Fire cutscene.
 *
 * FireScene3D — R3F component rendered inside <Canvas>. Igniting torus.
 * CutsceneFire — HTML overlay rendered outside Canvas. Text + dismiss.
 *
 * Progress driven by rAF in the HTML overlay; shared via ref.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { color, space } from '../design/tokens';
import { display, typeStyle } from '../design/typography';
import { triggerWhipCrack } from '../systems/audio/sfx';

const DURATION = 5.5;

const _hoopGeo = new THREE.TorusGeometry(3, 0.22, 12, 48);
const _hoopMat = new THREE.MeshStandardMaterial({
  color: 0xff4400,
  emissive: new THREE.Color(0xff2200),
  emissiveIntensity: 0,
  roughness: 0.3,
  metalness: 0.5,
});

/** R3F component — mount INSIDE Canvas */
export function FireScene3D({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    const p = progressRef.current;
    meshRef.current.rotation.set(Math.PI / 2, t * 0.5, 0);
    _hoopMat.emissiveIntensity = p * 2.5 * (0.8 + Math.sin(t * 8) * 0.2);
    _hoopMat.color.setHex(p > 0.3 ? 0xff6600 : 0x884400);
  });

  return <mesh ref={meshRef} geometry={_hoopGeo} material={_hoopMat} position={[0, 3.5, -6]} />;
}

/** HTML overlay — mount OUTSIDE Canvas */
export function CutsceneFire({ onDismiss }: { onDismiss: () => void }) {
  const startRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const dismissedRef = useRef(false);
  const audioFired = useRef(false);

  useEffect(() => {
    if (!audioFired.current) {
      audioFired.current = true;
      try { triggerWhipCrack(); } catch { /* audio may not be ready */ }
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
      data-testid="cutscene-fire"
      style={{
        position: 'absolute',
        top: '20%',
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
          color: color.red,
          textShadow: `3px 3px 0 ${color.yellow}`,
          opacity: Math.min(1, progress * 4),
        }}
      >
        RING OF FIRE
      </div>
      <div
        style={{
          ...typeStyle(display.tag),
          color: color.orange,
          marginTop: space.sm,
          opacity: Math.min(1, progress * 3),
        }}
      >
        *CRACK*
      </div>
      <button
        type="button"
        style={{
          marginTop: space.xl,
          padding: `${space.sm}px ${space.xl}px`,
          background: color.red,
          border: `2px solid ${color.orange}`,
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

export function useFireProgress(): React.MutableRefObject<number> {
  return useRef(0);
}
