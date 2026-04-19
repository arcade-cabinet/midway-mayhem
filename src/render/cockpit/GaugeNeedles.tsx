/**
 * Live gauge needles. LAUGHS and FUN are the two gauges flanking the
 * steering wheel; their needles sweep based on live game state:
 *
 *   LAUGHS  ← sanity-inverse (low sanity = big deflection, laugh meter
 *              maxed out when the driver's unhinged)
 *   FUN     ← hype-normalized (0..100 → 0..full-sweep)
 *
 * Mechanical details:
 *   - Full sweep is −60° (fully counter-clockwise = 0%) to +60°
 *     (fully clockwise = 100%). 120° total — mimics an analog dial.
 *   - Needle pivots at the face center; the box geometry is 0.0765m tall,
 *     so to rotate from the base we translate the needle up by half its
 *     length inside a child group, then rotate the PARENT group around
 *     the face-center pivot.
 *   - Smooth the target with exponential lerp so rapid state changes
 *     don't make the needle twitch.
 *
 * Blueprint gaugeNeedle_* meshes are ignored by the Cockpit loop when
 * this component is mounted; the loop skips anything isGaugeNeedleMesh
 * returns true for.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { cockpitBlueprint } from '@/config';
import { useGameStore } from '@/game/gameState';

const GAUGE_NEEDLE_NAMES = ['gaugeNeedle_LAUGHS', 'gaugeNeedle_FUN'] as const;

export function isGaugeNeedleMesh(name: string): boolean {
  return (GAUGE_NEEDLE_NAMES as readonly string[]).includes(name);
}

const MAX_SWEEP_RAD = (60 * Math.PI) / 180;
const LERP_SPEED = 5;

interface NeedleProps {
  faceName: 'gaugeFace_LAUGHS' | 'gaugeFace_FUN';
  needleName: 'gaugeNeedle_LAUGHS' | 'gaugeNeedle_FUN';
  target01: () => number;
}

function Needle({ faceName, needleName, target01 }: NeedleProps) {
  const smoothed = useRef(0);
  const groupRef = useRef<THREE.Group | null>(null);

  const face = cockpitBlueprint.meshes[faceName];
  const needle = cockpitBlueprint.meshes[needleName];
  const material = needle ? cockpitBlueprint.materials[needle.materialRef] : null;

  useFrame((_state, dt) => {
    const g = groupRef.current;
    if (!g) return;
    // 0..1 → -60°..+60°. 0% reads as needle pinned left, 100% as pinned right.
    const target = Math.max(-1, Math.min(1, target01() * 2 - 1));
    const k = 1 - Math.exp(-LERP_SPEED * dt);
    smoothed.current += (target - smoothed.current) * k;
    // Rotate around Z so the needle (tall on local Y) sweeps in the face plane.
    g.rotation.z = smoothed.current * MAX_SWEEP_RAD;
  });

  if (!face || !needle || !material) return null;
  if (!face.position) return null;
  const size = (needle.size ?? [0.01, 0.0765, 0.004]) as [number, number, number];
  const needleLen = size[1];

  return (
    <group
      name={`${needleName}-pivot`}
      position={face.position}
      rotation={face.rotation ?? [0, 0, 0]}
    >
      {/* Rotating parent — Z axis points out of the face, needle sweeps in the face plane. */}
      <group ref={groupRef} name={needleName}>
        {/* Child offset so the needle base sits at pivot */}
        <mesh position={[0, needleLen / 2, 0.002]}>
          <boxGeometry args={size} />
          <meshStandardMaterial
            color={material.baseColor}
            roughness={material.roughness}
            metalness={material.metalness}
          />
        </mesh>
      </group>
    </group>
  );
}

export function GaugeNeedles() {
  return (
    <>
      <Needle
        faceName="gaugeFace_LAUGHS"
        needleName="gaugeNeedle_LAUGHS"
        target01={() => {
          // LAUGHS grows as sanity drops: 100 sanity → 0.1 laugh; 0 sanity → 1.0 laugh.
          const sanity = useGameStore.getState().sanity;
          return 1 - Math.max(0, Math.min(100, sanity)) / 100;
        }}
      />
      <Needle
        faceName="gaugeFace_FUN"
        needleName="gaugeNeedle_FUN"
        target01={() => {
          // FUN tracks hype 0..100.
          const hype = useGameStore.getState().hype;
          return Math.max(0, Math.min(100, hype)) / 100;
        }}
      />
    </>
  );
}
