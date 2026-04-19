/**
 * HonkableHorn — the red cap + chrome ring on the steering-wheel hub,
 * clickable via R3F's pointer-event system. Click fires the honk audio
 * (from HonkContext) and plays a tiny squish animation.
 *
 * The cap + ring meshes are still rendered from the blueprint; this
 * component wraps the hornCap mesh in a pressable group that scales Y
 * down to 0.6 on pointer-down then lerps back to 1 over ~180ms. The
 * ring stays rigid because in a real car the chrome ring is around the
 * cap, not on top of it.
 *
 * Cockpit.tsx filters 'hornCap' out of the generic mesh loop so only
 * this component renders it.
 */
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type * as THREE from 'three';
import { cockpitBlueprint } from '@/config';
import { useHonk } from './HonkContext';

export function isHonkableMesh(name: string): boolean {
  return name === 'hornCap';
}

const SQUISH_DOWN = 0.55;
const SQUISH_RECOVERY_S = 0.18;

export function HonkableHorn() {
  const honk = useHonk();
  const capRef = useRef<THREE.Mesh | null>(null);
  const squishT = useRef(0);
  const [hovered, setHovered] = useState(false);

  const cap = cockpitBlueprint.meshes.hornCap;
  const material = cap ? cockpitBlueprint.materials[cap.materialRef] : null;

  useFrame((_state, dt) => {
    const mesh = capRef.current;
    if (!mesh) return;
    // squishT is 0 at rest, 1 right after click, decays to 0 over recovery.
    squishT.current = Math.max(0, squishT.current - dt / SQUISH_RECOVERY_S);
    const s = 1 - (1 - SQUISH_DOWN) * squishT.current;
    mesh.scale.y = s;
  });

  if (!cap || cap.type !== 'cylinder' || !material) return null;
  if (!cap.position) return null;
  const radius = cap.radius ?? 0.07;
  const length = cap.length ?? 0.02;

  return (
    <mesh
      ref={capRef}
      name="hornCap"
      position={cap.position}
      rotation={cap.rotation ?? [0, 0, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        squishT.current = 1;
        honk();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = '';
      }}
    >
      <cylinderGeometry args={[radius, radius, length, 20]} />
      <meshStandardMaterial
        color={material.baseColor}
        roughness={material.roughness}
        metalness={material.metalness}
        emissive={hovered ? '#ff2010' : '#000000'}
        emissiveIntensity={hovered ? 0.25 : 0}
      />
    </mesh>
  );
}
