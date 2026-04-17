/**
 * Big-top environment: circus-arena HDRI as the surrounding dome + a
 * canvas-tented ground plane. This is the "world" every other render lives
 * inside. The HDRI is full 360° × 180° immersion — not a skybox half-shell —
 * so wherever the camera looks from inside the cockpit, it sees circus fabric
 * or the ring crowd. The ground plane is warm canvas red at a slight downtilt
 * so it reads as real floor, not as infinite plane.
 *
 * Drop this into any scene that wants full arcade ambience. Component-level
 * tests render geometry against the plain dark bg and skip this — that's
 * where we want tight visual isolation on the single archetype.
 */
import { Environment as DreiEnvironment } from '@react-three/drei';
import * as THREE from 'three';

interface BigTopEnvironmentProps {
  /** Path to the HDRI (defaults to /hdri/circus_arena_2k.hdr). */
  hdriPath?: string;
  /** Render the HDRI as visible background (true) or only as IBL (false). */
  showBackground?: boolean;
  /** Y-height of the ground plane (usually negative, below the track). */
  groundY?: number;
  /** Skip HDRI entirely — useful in tests where drei's useEnvironment
   *  context dies inside the vitest iframe. The ground + fill lights
   *  alone are a fine visual-regression stand-in. */
  skipHdri?: boolean;
}

/**
 * Big-top environment: circus-arena HDRI as the surrounding dome + a warm
 * canvas ground plane. Drop this into any scene that wants full arcade
 * ambience. Component-level tests render geometry against the plain dark
 * bg and skip this — that's where we want tight visual isolation on the
 * single archetype. Composed-track tests use `skipHdri` so the environment
 * is just ground + the scene's existing lights.
 */
export function BigTopEnvironment({
  hdriPath = `${import.meta.env.BASE_URL}hdri/circus_arena_2k.hdr`,
  showBackground = true,
  groundY = -60,
  skipHdri = false,
}: BigTopEnvironmentProps) {
  return (
    <>
      {skipHdri ? null : <DreiEnvironment files={hdriPath} background={showBackground} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY, 0]} receiveShadow>
        <circleGeometry args={[800, 64]} />
        <meshStandardMaterial
          color="#6b1410"
          roughness={0.9}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}
