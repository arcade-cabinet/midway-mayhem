/**
 * CutsceneStrip — Midway Strip cutscene.
 * Rendered as an HTML overlay (NOT inside Canvas).
 * Barker monologue scrolls above the crowd; honk sound plays.
 * Progress driven by requestAnimationFrame (no framer-motion, no useFrame).
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { color, space } from '@/design/tokens';
import { display, typeStyle } from '@/design/typography';
import { triggerClownHorn } from '@/audio/sfx';

interface Props {
  onDismiss: () => void;
}

const DURATION = 5.0;

export function CutsceneStrip({ onDismiss }: Props) {
  const startRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const dismissedRef = useRef(false);

  useEffect(() => {
    try { triggerClownHorn(); } catch { /* audio may not be ready */ }
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000;
      const p = Math.min(1, elapsed / DURATION);
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

  const lineY = -60 + progress * 80; // scrolls up

  return (
    <div
      data-testid="cutscene-strip"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          height: 160,
          width: '80%',
          maxWidth: 640,
          background: `${color.night}cc`,
          border: `2px solid ${color.yellow}`,
          borderRadius: 12,
          padding: `${space.md}px ${space.xl}px`,
        }}
      >
        <div
          style={{
            transform: `translateY(${lineY}px)`,
            ...typeStyle(display.banner),
            color: color.yellow,
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          STEP RIGHT UP!
          <br />
          <span style={{ color: color.white, fontSize: '1.2rem' }}>
            The GREATEST show on wheels!
          </span>
          <br />
          <span style={{ color: color.red, fontSize: '1rem' }}>
            HONK IF YOU DARE!!
          </span>
        </div>
      </div>
      <button
        type="button"
        style={{
          marginTop: space.xl,
          padding: `${space.sm}px ${space.xl}px`,
          background: color.red,
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

/** 3D barker stand prop — used inside Canvas scenes */
export function BarkerStandMesh({ position }: { position: [number, number, number] }) {
  const podiumGeo = new THREE.BoxGeometry(1.2, 2.0, 1.2);
  const hatGeo = new THREE.ConeGeometry(0.5, 1.2, 8);
  const podiumMat = new THREE.MeshStandardMaterial({ color: 0xffd600, roughness: 0.7 });
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.5 });
  const podiumMesh = new THREE.Mesh(podiumGeo, podiumMat);
  const hatMesh = new THREE.Mesh(hatGeo, hatMat);
  hatMesh.position.set(0, 1.6, 0);

  const group = new THREE.Group();
  group.add(podiumMesh);
  group.add(hatMesh);
  group.position.set(...position);

  return <primitive object={group} />;
}
