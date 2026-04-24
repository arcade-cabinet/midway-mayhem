/**
 * SteeringWheel — chrome rim, 4 spokes, hub, tilted toward the driver.
 * Rotates around the column axis based on live `steer` input.
 *
 * Hand-authored: wheel sits at (0, 1.05, 0.15), tilted 36° back (+X axis
 * rotation) so the driver sees the wheel face. The hornCap is owned by
 * HonkableHorn.tsx.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { useGameStore } from '@/game/gameState';

const WHEEL_NAME_PATTERN = /^(wheelRim|wheelHub|wheelSpoke\d+)$/;

export function isWheelMesh(name: string): boolean {
  return WHEEL_NAME_PATTERN.test(name);
}

/** Max rotation at ±1 steer, radians (~90°). */
const MAX_WHEEL_ROT_RAD = (90 * Math.PI) / 180;
const WHEEL_LERP = 8;

const RIM_MAJOR_RADIUS = 0.22;
const RIM_MINOR_RADIUS = 0.022;
const HUB_RADIUS = 0.05;

export function SteeringWheel() {
  const spinRef = useRef<THREE.Group | null>(null);
  const smoothed = useRef(0);

  useFrame((_state, dt) => {
    const g = spinRef.current;
    if (!g) return;
    const steer = Math.max(-1, Math.min(1, useGameStore.getState().steer));
    const target = -steer * MAX_WHEEL_ROT_RAD;
    const k = 1 - Math.exp(-WHEEL_LERP * dt);
    smoothed.current += (target - smoothed.current) * k;
    g.rotation.z = smoothed.current;
  });

  const chromeMaterial = <meshStandardMaterial color="#d8d8d8" roughness={0.2} metalness={0.9} />;

  return (
    <group name="steering-wheel-pivot" position={[0, 1.05, 0.15]} rotation={[0.628, 0, 0]}>
      <group ref={spinRef} name="steering-wheel-spin">
        {/* Rim — torus in the wheel-local XY plane. */}
        <mesh name="wheelRim">
          <torusGeometry args={[RIM_MAJOR_RADIUS, RIM_MINOR_RADIUS, 16, 36]} />
          {chromeMaterial}
        </mesh>

        {/* Hub — short cylinder at center, axis along +Z (out of wheel face). */}
        <mesh name="wheelHub" rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[HUB_RADIUS, HUB_RADIUS, 0.04, 20]} />
          {chromeMaterial}
        </mesh>

        {/* 4 spokes — thin boxes from hub to rim. */}
        <mesh name="wheelSpoke1" position={[0, (RIM_MAJOR_RADIUS + HUB_RADIUS) / 2 - 0.01, 0]}>
          <boxGeometry args={[0.022, RIM_MAJOR_RADIUS - HUB_RADIUS, 0.02]} />
          {chromeMaterial}
        </mesh>
        <mesh name="wheelSpoke2" position={[0, -((RIM_MAJOR_RADIUS + HUB_RADIUS) / 2 - 0.01), 0]}>
          <boxGeometry args={[0.022, RIM_MAJOR_RADIUS - HUB_RADIUS, 0.02]} />
          {chromeMaterial}
        </mesh>
        <mesh name="wheelSpoke3" position={[(RIM_MAJOR_RADIUS + HUB_RADIUS) / 2 - 0.01, 0, 0]}>
          <boxGeometry args={[RIM_MAJOR_RADIUS - HUB_RADIUS, 0.022, 0.02]} />
          {chromeMaterial}
        </mesh>
        <mesh name="wheelSpoke4" position={[-((RIM_MAJOR_RADIUS + HUB_RADIUS) / 2 - 0.01), 0, 0]}>
          <boxGeometry args={[RIM_MAJOR_RADIUS - HUB_RADIUS, 0.022, 0.02]} />
          {chromeMaterial}
        </mesh>
      </group>
    </group>
  );
}
