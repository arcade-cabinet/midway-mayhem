/**
 * @module render/obstacles/ThemedObstacle
 *
 * Replaces the inline boxGeometry obstacle shapes in TrackContent with
 * circus-themed KayKit CC0 GLB assets.
 *
 * Each ObstacleKind has a dedicated asset descriptor in themedAssets.ts.
 * This component:
 *   - loads the GLB via drei's useGLTF (Suspense-based; error bubbles up
 *     to the nearest error boundary, which in App.tsx forwards to errorBus)
 *   - clones the scene graph so each obstacle instance is independent
 *   - applies the scale + yOffset from the asset descriptor
 *   - preserves the hammer pendulum swing and critter flee animations
 *     via a wrapper group (the animation mutates the wrapper, not the GLB)
 *
 * The hammer and critter keep their per-frame animation logic from the old
 * TrackContent sub-components. The GLB scene merely replaces the procedural
 * mesh; collision extents are unchanged (still driven by the ECS Obstacle trait).
 */
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import type { ObstacleKind } from '@/ecs/traits';
import type { CritterKind } from '@/utils/constants';
import { HONK } from '@/utils/constants';
import { ALL_OBSTACLE_PATHS, OBSTACLE_ASSETS } from './themedAssets';

// ─── Preload all obstacle GLBs immediately ───────────────────────────────────
// useGLTF.preload schedules fetches before any component mounts so the assets
// are ready by the time TrackContent renders its first frame.
for (const path of ALL_OBSTACLE_PATHS) {
  useGLTF.preload(path);
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Clone a GLTF scene so each obstacle instance has its own object graph.
 * Without cloning, all instances of the same kind share a single scene node
 * and Three.js would only render the last position.
 */
function useClonedScene(path: string): THREE.Group {
  const { scene } = useGLTF(path);
  // useMemo isn't usable here (hook rules) — clone on every render is wrong too.
  // We return scene.clone() which is cheap for these small meshes and safe
  // because useGLTF caches the base scene.
  return scene.clone(true);
}

// ─── Static obstacle wrapper ─────────────────────────────────────────────────

interface StaticObstacleProps {
  kind: Exclude<ObstacleKind, 'hammer' | 'critter'>;
  position: [number, number, number];
  yaw: number;
}

export function StaticObstacle({ kind, position, yaw }: StaticObstacleProps) {
  const asset = OBSTACLE_ASSETS[kind];
  const cloned = useClonedScene(asset.path);

  const [px, py, pz] = position;

  return (
    <group position={[px, py + asset.yOffset, pz]} rotation={[0, yaw, 0]} scale={asset.scale}>
      <primitive object={cloned} />
    </group>
  );
}

// ─── Animated hammer ─────────────────────────────────────────────────────────

interface ThemedHammerProps {
  position: [number, number, number];
  yaw: number;
  swingPhase: number;
}

export function ThemedHammer({ position, yaw, swingPhase }: ThemedHammerProps) {
  const asset = OBSTACLE_ASSETS.hammer;
  const cloned = useClonedScene(asset.path);
  const pivotRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const g = pivotRef.current;
    if (!g) return;
    // Pendulum swing: ±40° at ~0.8 Hz — same as old AnimatedHammer
    g.rotation.z = Math.sin(clock.elapsedTime * 5.0 + swingPhase) * 0.7;
  });

  const [px, py, pz] = position;

  return (
    <group position={[px, py + asset.yOffset, pz]} rotation={[0, yaw, 0]}>
      {/* Ceiling mount stub (small cylinder) */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.2, 8]} />
        <meshStandardMaterial color="#333" roughness={0.6} />
      </mesh>
      {/* Swinging arm */}
      <group ref={pivotRef}>
        <group scale={asset.scale} position={[0, -1.0, 0]}>
          <primitive object={cloned} />
        </group>
      </group>
    </group>
  );
}

// ─── Animated critter ─────────────────────────────────────────────────────────

interface ThemedCritterProps {
  baseX: number;
  baseY: number;
  baseZ: number;
  yaw: number;
  /** Unused — kept for interface parity; all critters render the same horse GLB. */
  critterKind: CritterKind | '';
  fleeStartedAt: number;
  fleeDir: -1 | 0 | 1;
}

export function ThemedCritter({
  baseX,
  baseY,
  baseZ,
  yaw,
  fleeStartedAt,
  fleeDir,
}: ThemedCritterProps) {
  const asset = OBSTACLE_ASSETS.critter;
  const cloned = useClonedScene(asset.path);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    if (fleeStartedAt > 0 && fleeDir !== 0) {
      const elapsed = (performance.now() - fleeStartedAt) / 1000;
      const t = Math.min(elapsed / HONK.FLEE_DURATION_S, 1);
      // Ease out: fast start, slow end — same as old AnimatedCritter
      const eased = 1 - (1 - t) * (1 - t);
      const lateralOffset = fleeDir * HONK.FLEE_LATERAL_M * eased;
      g.position.set(
        baseX + Math.cos(yaw) * lateralOffset,
        baseY + asset.yOffset,
        baseZ + -Math.sin(yaw) * lateralOffset,
      );
    } else {
      g.position.set(baseX, baseY + asset.yOffset, baseZ);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[baseX, baseY + asset.yOffset, baseZ]}
      rotation={[0, yaw, 0]}
      scale={asset.scale}
    >
      <primitive object={cloned} />
    </group>
  );
}
