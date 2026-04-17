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
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { DoubleSide, RingGeometry } from 'three';
import { Player, Score } from '@/ecs/traits';

export function BoostRush() {
  const { camera } = useThree();
  const world = useWorld();
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    camera.add(m);
    m.position.set(0, 0, -1);
    return () => {
      camera.remove(m);
    };
  }, [camera]);

  useFrame(() => {
    const mat = matRef.current;
    if (!mat) return;
    const player = world.query(Player, Score)[0];
    if (!player) {
      mat.opacity = 0;
      return;
    }
    const score = player.get(Score);
    if (!score) return;
    // Ramp up quickly when boost fires, smooth out when it expires.
    const active = score.boostRemaining > 0 ? 1 : 0;
    const target = active * 0.6;
    mat.opacity += (target - mat.opacity) * 0.18;
  });

  // Big ring: inner radius ~0.9, outer 2.0 (way off-screen). As vignette,
  // darkens the outer frame while center stays clear.
  const geometry = new RingGeometry(0.9, 2.0, 48);
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
