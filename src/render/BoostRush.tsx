/**
 * Boost-window visual rush — a camera-parented dark ring overlay that
 * darkens the periphery during boost, mimicking motion-blur tunnel vision
 * without the cost (or crash risk) of a real motion-blur post effect.
 *
 * Combines with the existing Vignette in PostFX; this layer stacks on top
 * so the effect only intensifies when Score.boostRemaining > 0.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useWorld } from 'koota/react';
import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { DoubleSide, RingGeometry } from 'three';
import { Player, Score } from '@/ecs/traits';

/** Time-constant for opacity smoothing toward target (seconds). Using an
 *  exponential 1 - exp(-dt/τ) lerp keeps the fade feel identical across
 *  60Hz and 144Hz displays — flagged in PR #17 feedback. */
const OPACITY_TAU = 0.1;

export function BoostRush() {
  const { camera } = useThree();
  const world = useWorld();
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  // Memoize geometry — instantiating a RingGeometry every render allocates
  // a fresh GPU buffer each time and never disposes the old one. Was
  // flagged in PR #17 review as a performance regression.
  const geometry = useMemo(() => new RingGeometry(0.9, 2.0, 48), []);

  useEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    camera.add(m);
    m.position.set(0, 0, -1);
    return () => {
      camera.remove(m);
    };
  }, [camera]);

  // Dispose the memoized geometry when the component unmounts so there's
  // no GPU-buffer leak on hot reload.
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame((_state, dt) => {
    const mat = matRef.current;
    if (!mat) return;
    const player = world.query(Player, Score)[0];
    if (!player) {
      mat.opacity = 0;
      return;
    }
    const score = player.get(Score);
    if (!score) return;
    const active = score.boostRemaining > 0 ? 1 : 0;
    const target = active * 0.6;
    // Frame-rate-independent smoothing: ~1-exp(-dt/τ) approach toward target.
    const alpha = 1 - Math.exp(-Math.min(dt, 0.1) / OPACITY_TAU);
    mat.opacity += (target - mat.opacity) * alpha;
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial
        ref={matRef}
        color="#0b0f1a"
        transparent
        opacity={0}
        side={DoubleSide}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
