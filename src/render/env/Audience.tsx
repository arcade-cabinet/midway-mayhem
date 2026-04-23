/**
 * Audience — 2000-instance crowd silhouettes filling the big-top bleachers.
 *
 * One InstancedMesh draw call using CapsuleGeometry (~1.2m tall, 0.35m
 * radius) — each instance is a seated/standing humanoid silhouette at dome
 * scale. Per-instance color cycles the brand palette. Idle bob animation
 * (±0.08m, wave pattern driven by per-instance phase) runs in useFrame with
 * zero per-frame heap allocation.
 *
 * Drop this OUTSIDE the WorldScroller so the audience is world-static:
 *   <Suspense fallback={null}>
 *     <BigTopEnvironment />
 *     <Audience />           ← here, sibling of BigTopEnvironment
 *   </Suspense>
 *
 * CapsuleGeometry is available in Three.js ≥ 0.142. If the geometry
 * constructor throws (version mismatch), the error surfaces via React's
 * error boundary rather than silently degrading.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { AUDIENCE_PALETTE, audiencePositions } from './audiencePositions';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Total number of silhouette instances. One draw call, 2000 capsules. */
const INSTANCE_COUNT = 2000;

/** Deterministic seed — fixed so CI screenshot baselines never drift. */
const AUDIENCE_SEED = 0xad13;

/** Capsule dimensions. Reads as a seated/standing human at dome scale. */
const CAPSULE_RADIUS = 0.35;
const CAPSULE_HEIGHT = 1.2; // body length between the two hemisphere caps
const CAPSULE_CAP_SEGS = 4;
const CAPSULE_BODY_SEGS = 1;

/** Idle bob amplitude (metres) and angular speed (rad/s). */
const BOB_AMPLITUDE = 0.08;
const BOB_SPEED = 0.9;

// ─── Pre-baked palette colors ────────────────────────────────────────────────

/** Convert hex strings to THREE.Color objects once at module load. */
const PALETTE_COLORS = AUDIENCE_PALETTE.map((hex) => new THREE.Color(hex));

// ─── Component ──────────────────────────────────────────────────────────────

export function Audience() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Geometry — CapsuleGeometry(radius, length, capSegments, radialSegments).
  // Constructed via useMemo so it is created once and reused across StrictMode
  // double-invocations. If the constructor throws, React's error boundary
  // catches it and shows the global error modal (no silent fallback).
  const geometry = useMemo(
    () =>
      new THREE.CapsuleGeometry(
        CAPSULE_RADIUS,
        CAPSULE_HEIGHT,
        CAPSULE_CAP_SEGS,
        CAPSULE_BODY_SEGS * 6,
      ),
    [],
  );

  // Pre-bake the per-instance positions so we don't recompute on every frame.
  const seats = useMemo(() => audiencePositions(AUDIENCE_SEED, INSTANCE_COUNT), []);

  // Per-instance base Y values — used each frame to apply the bob offset.
  const baseYs = useMemo(() => Float32Array.from(seats, (s) => s.y), [seats]);

  // Pre-allocate Matrix4 + supporting objects outside useFrame to avoid GC.
  const mat = useMemo(() => new THREE.Matrix4(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const scale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  // Per-axis Y rotation — we only rotate around Y so we cache a Vector3.
  const axis = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  // Track whether initial color setup has happened.
  const colorsInitialised = useRef(false);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const t = clock.elapsedTime;

    // Set per-instance colors once (the instanceColor buffer is lazily
    // created by Three.js on the first setColorAt call).
    if (!colorsInitialised.current) {
      for (let i = 0; i < INSTANCE_COUNT; i++) {
        const color = PALETTE_COLORS[i % PALETTE_COLORS.length]!;
        mesh.setColorAt(i, color);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      colorsInitialised.current = true;
    }

    // Update per-instance matrices with idle bob.
    for (let i = 0; i < INSTANCE_COUNT; i++) {
      const seat = seats[i]!;
      const bobY = BOB_AMPLITUDE * Math.sin(t * BOB_SPEED + seat.bobPhase);

      pos.set(seat.x, baseYs[i]! + bobY, seat.z);
      quat.setFromAxisAngle(axis, seat.rotY);
      mat.compose(pos, quat, scale);
      mesh.setMatrixAt(i, mat);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, INSTANCE_COUNT]} frustumCulled={false}>
      <meshStandardMaterial
        roughness={0.85}
        metalness={0.0}
        // Base color is overridden per-instance via instanceColor.
        // vertexColors tells Three.js to use the instanceColor buffer.
        vertexColors
      />
    </instancedMesh>
  );
}
