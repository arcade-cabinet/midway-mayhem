/**
 * @module cockpit/CockpitSteeringWheel
 *
 * Steering wheel group: torus rim, chrome spokes, column, and honkable
 * horn cap. The horn cap visibly depresses on press (mirrors the POC)
 * and springs back to rest over ~180 ms.
 *
 * Extracted from Cockpit.tsx to keep that file under 300 LOC.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';

interface CockpitSteeringWheelProps {
  wheelRef: React.RefObject<THREE.Group | null>;
  chromeMat: THREE.MeshPhysicalMaterial;
  rimColor: string;
}

const HORN_REST_Z = 0.03;
const HORN_PRESS_DEPTH = 0.018;
const HORN_RELEASE_TAU = 0.06;

export function CockpitSteeringWheel({ wheelRef, chromeMat, rimColor }: CockpitSteeringWheelProps) {
  const hornRef = useRef<THREE.Mesh>(null);
  const pressedAtRef = useRef(0);

  useFrame((_, dt) => {
    const h = hornRef.current;
    if (!h) return;
    const now = performance.now();
    const since = (now - pressedAtRef.current) / 1000;
    let offset: number;
    if (pressedAtRef.current === 0) {
      offset = 0;
    } else if (since < 0.06) {
      offset = -HORN_PRESS_DEPTH;
    } else {
      const decay = Math.exp(-((since - 0.06) / HORN_RELEASE_TAU));
      offset = -HORN_PRESS_DEPTH * decay;
      if (Math.abs(offset) < 0.0001) {
        offset = 0;
        pressedAtRef.current = 0;
      }
    }
    const target = HORN_REST_Z + offset;
    h.position.z += (target - h.position.z) * Math.min(1, dt * 30);
  });

  const onHornPress = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    pressedAtRef.current = performance.now();
    // Marker so Game.tsx's tap-to-capture DOM handler ignores this event.
    // biome-ignore lint/suspicious/noExplicitAny: dev hook
    (window as any).__mmHornPressedAt = pressedAtRef.current;
    // biome-ignore lint/suspicious/noExplicitAny: dev hook
    (window as any).__mmHonk?.();
  };

  return (
    <group ref={wheelRef} position={[0, 0.82, 0.2]} rotation={[-Math.PI / 4.3, 0, 0]}>
      <mesh position={[0, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]} material={chromeMat}>
        <cylinderGeometry args={[0.035, 0.035, 0.6, 10]} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.4, 0.06, 18, 36]} />
        <meshPhysicalMaterial
          color={rimColor}
          roughness={0.2}
          metalness={0.3}
          clearcoat={0.8}
          clearcoatRoughness={0.1}
        />
      </mesh>
      <mesh material={chromeMat}>
        <cylinderGeometry args={[0.022, 0.022, 0.78, 10]} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} material={chromeMat}>
        <cylinderGeometry args={[0.022, 0.022, 0.78, 10]} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]} material={chromeMat}>
        <cylinderGeometry args={[0.022, 0.022, 0.78, 10]} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]} material={chromeMat}>
        <cylinderGeometry args={[0.018, 0.018, 0.78, 10]} />
      </mesh>
      {/* Horn cap — red, honkable, visibly depresses on press. */}
      <mesh
        ref={hornRef}
        name="horn"
        position={[0, 0, HORN_REST_Z]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerDown={onHornPress}
      >
        <cylinderGeometry args={[0.15, 0.18, 0.08, 28]} />
        <meshStandardMaterial color="#ff3e3e" emissive="#330808" />
      </mesh>
      <mesh position={[0, 0, 0.025]} material={chromeMat}>
        <torusGeometry args={[0.18, 0.025, 10, 24]} />
      </mesh>
    </group>
  );
}
