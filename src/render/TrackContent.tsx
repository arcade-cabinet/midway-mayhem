/**
 * Renders all obstacles + pickups that live ON the track (Path A — canonical).
 *
 * Each entity knows its own (distance, lateral) in track space; we resolve
 * that to world-space via useSampledTrack + sampleTrackPose so everything
 * stays perfectly on-rails.
 *
 * All geometry uses Three.js primitives — no GLB loads, no /models/ paths.
 * New obstacle kinds (critter, hammer) animate per-frame.
 * Critters apply a lateral flee displacement driven by fleeStartedAt / fleeDir
 * set by ObstacleSystem's honk-scare bridge.
 *
 * Rendered inside the Track group so the parent's per-frame counter-rotation
 * sweeps entities past the cockpit automatically.
 */
import { useFrame } from '@react-three/fiber';
import { useQuery } from 'koota/react';
import { useRef } from 'react';
import * as THREE from 'three';
import { sampleTrackPose } from '@/ecs/systems/trackSampler';
import { useSampledTrack } from '@/ecs/systems/useSampledTrack';
import { Obstacle, Pickup } from '@/ecs/traits';
import type { CritterKind } from '@/utils/constants';
import { COLORS, HONK } from '@/utils/constants';

// ─── Critter colors ──────────────────────────────────────────────────────────

const CRITTER_COLORS: Record<CritterKind, string> = {
  cow: '#f5f5f5',
  horse: '#8b4513',
  llama: '#deb887',
  pig: '#ffb6c1',
};

// ─── Bobbing balloon sub-component ──────────────────────────────────────────

const BALLOON_COLORS = [COLORS.RED, COLORS.BLUE, COLORS.YELLOW, COLORS.ORANGE, '#c71585'];

function BobbingBalloon({
  anchor,
  phase,
  color,
}: {
  anchor: [number, number, number];
  phase: number;
  color: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.position.y = anchor[1] + Math.sin(t * 1.6 + phase) * 0.12;
    g.rotation.y = t * 0.4 + phase;
  });
  return (
    <group ref={groupRef} position={anchor}>
      <mesh>
        <sphereGeometry args={[0.35, 16, 12]} />
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.1}
          emissive={color}
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh position={[0, -0.45, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.5, 4]} />
        <meshBasicMaterial color={COLORS.YELLOW} />
      </mesh>
    </group>
  );
}

// ─── Animated hammer sub-component ──────────────────────────────────────────

function AnimatedHammer({
  position,
  yaw,
  swingPhase,
}: {
  position: [number, number, number];
  yaw: number;
  swingPhase: number;
}) {
  const pivotRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = pivotRef.current;
    if (!g) return;
    // Pendulum swing: ±40° at ~0.8 Hz
    g.rotation.z = Math.sin(clock.elapsedTime * 5.0 + swingPhase) * 0.7;
  });
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* Pivot at top */}
      <group ref={pivotRef}>
        {/* Handle */}
        <mesh position={[0, -0.8, 0]}>
          <boxGeometry args={[0.2, 1.6, 0.2]} />
          <meshStandardMaterial color="#5d4037" roughness={0.7} />
        </mesh>
        {/* Head */}
        <mesh position={[0, -1.7, 0]}>
          <boxGeometry args={[1.4, 0.9, 1.4]} />
          <meshStandardMaterial color={COLORS.BLUE} roughness={0.5} metalness={0.4} />
        </mesh>
      </group>
      {/* Ceiling mount */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.2, 8]} />
        <meshStandardMaterial color="#333" roughness={0.6} />
      </mesh>
    </group>
  );
}

// ─── Animated critter sub-component ─────────────────────────────────────────

function AnimatedCritter({
  baseX,
  baseY,
  baseZ,
  yaw,
  critterKind,
  fleeStartedAt,
  fleeDir,
}: {
  baseX: number;
  baseY: number;
  baseZ: number;
  yaw: number;
  critterKind: CritterKind | '';
  fleeStartedAt: number;
  fleeDir: -1 | 0 | 1;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const color = CRITTER_COLORS[(critterKind as CritterKind) || 'cow'] ?? '#fff';

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    if (fleeStartedAt > 0 && fleeDir !== 0) {
      const elapsed = (performance.now() - fleeStartedAt) / 1000;
      const t = Math.min(elapsed / HONK.FLEE_DURATION_S, 1);
      // Ease out: fast start, slow end
      const eased = 1 - (1 - t) * (1 - t);
      const lateralOffset = fleeDir * HONK.FLEE_LATERAL_M * eased;
      // Apply offset in world-space right direction
      g.position.set(
        baseX + Math.cos(yaw) * lateralOffset,
        baseY,
        baseZ + -Math.sin(yaw) * lateralOffset,
      );
    } else {
      g.position.set(baseX, baseY, baseZ);
    }
  });

  return (
    <group ref={groupRef} position={[baseX, baseY, baseZ]} rotation={[0, yaw, 0]}>
      {/* Body */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.9, 0.7, 1.4]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.1, 0.55]}>
        <boxGeometry args={[0.6, 0.55, 0.6]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* Legs (4x) */}
      {(
        [
          [-0.3, 0, 0.4],
          [0.3, 0, 0.4],
          [-0.3, 0, -0.4],
          [0.3, 0, -0.4],
        ] as [number, number, number][]
      ).map((lp) => (
        <mesh key={`${lp[0]},${lp[2]}`} position={[lp[0], lp[1] + 0.15, lp[2]]}>
          <boxGeometry args={[0.18, 0.5, 0.18]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function TrackContent() {
  const sampled = useSampledTrack();
  const obstacles = useQuery(Obstacle);
  const pickups = useQuery(Pickup);

  if (sampled.length === 0) return null;

  return (
    <group name="track-content">
      {/* ── Obstacles ── */}
      {obstacles.map((e) => {
        const ob = e.get(Obstacle);
        if (!ob || ob.consumed) return null;
        const p = sampleTrackPose(sampled, ob.distance);
        const rightX = Math.cos(p.yaw);
        const rightZ = -Math.sin(p.yaw);
        const x = p.x + rightX * ob.lateral;
        const z = p.z + rightZ * ob.lateral;
        const id = e.id();

        switch (ob.kind) {
          case 'cone':
            return (
              <group key={id} position={[x, p.y, z]} rotation={[0, p.yaw, 0]}>
                <mesh position={[0, 0.5, 0]}>
                  <coneGeometry args={[0.35, 1.0, 12]} />
                  <meshStandardMaterial color={COLORS.ORANGE} roughness={0.5} />
                </mesh>
                <mesh position={[0, 0.2, 0]}>
                  <cylinderGeometry args={[0.42, 0.42, 0.08, 12]} />
                  <meshStandardMaterial color="#3a1a00" roughness={0.85} />
                </mesh>
              </group>
            );

          case 'oil':
            return (
              <mesh key={id} position={[x, p.y + 0.01, z]} rotation={[-Math.PI / 2, 0, p.yaw]}>
                <circleGeometry args={[1.4, 16]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.4} />
              </mesh>
            );

          case 'barrier':
            return (
              <group key={id} position={[x, p.y, z]} rotation={[0, p.yaw, 0]}>
                <mesh position={[0, 0.6, 0]}>
                  <boxGeometry args={[1.8, 1.2, 0.35]} />
                  <meshStandardMaterial color={COLORS.RED} roughness={0.6} />
                </mesh>
                <mesh position={[0, 0.6, 0.18]}>
                  <boxGeometry args={[1.85, 0.25, 0.01]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.6} />
                </mesh>
              </group>
            );

          case 'gate':
            return (
              <group key={id} position={[x, p.y, z]} rotation={[0, p.yaw, 0]}>
                <mesh position={[-1.2, 1.0, 0]}>
                  <boxGeometry args={[0.3, 2.0, 0.3]} />
                  <meshStandardMaterial color={COLORS.PURPLE} roughness={0.5} metalness={0.3} />
                </mesh>
                <mesh position={[1.2, 1.0, 0]}>
                  <boxGeometry args={[0.3, 2.0, 0.3]} />
                  <meshStandardMaterial color={COLORS.PURPLE} roughness={0.5} metalness={0.3} />
                </mesh>
                <mesh position={[0, 2.1, 0]}>
                  <boxGeometry args={[2.7, 0.35, 0.3]} />
                  <meshStandardMaterial
                    color={COLORS.YELLOW}
                    emissive={COLORS.YELLOW}
                    emissiveIntensity={0.4}
                    roughness={0.3}
                  />
                </mesh>
              </group>
            );

          case 'hammer':
            return (
              <AnimatedHammer
                key={id}
                position={[x, p.y + 2.2, z]}
                yaw={p.yaw}
                swingPhase={ob.swingPhase}
              />
            );

          case 'critter':
            return (
              <AnimatedCritter
                key={id}
                baseX={x}
                baseY={p.y}
                baseZ={z}
                yaw={p.yaw}
                critterKind={ob.critterKind}
                fleeStartedAt={ob.fleeStartedAt}
                fleeDir={ob.fleeDir}
              />
            );

          default:
            return null;
        }
      })}

      {/* ── Pickups ── */}
      {pickups.map((e) => {
        const pu = e.get(Pickup);
        if (!pu || pu.consumed) return null;
        const p = sampleTrackPose(sampled, pu.distance);
        const rightX = Math.cos(p.yaw);
        const rightZ = -Math.sin(p.yaw);
        const x = p.x + rightX * pu.lateral;
        const z = p.z + rightZ * pu.lateral;
        const id = e.id();

        switch (pu.kind) {
          case 'balloon': {
            const color = BALLOON_COLORS[id % BALLOON_COLORS.length] ?? BALLOON_COLORS[0];
            const phase = (id * 0.57) % (Math.PI * 2);
            return (
              <BobbingBalloon
                key={id}
                anchor={[x, p.y + 1.6, z]}
                phase={phase}
                color={color as string}
              />
            );
          }

          case 'boost':
            return (
              <mesh key={id} position={[x, p.y + 0.02, z]} rotation={[-Math.PI / 2, 0, p.yaw]}>
                <planeGeometry args={[1.8, 2.2]} />
                <meshStandardMaterial
                  color="#00e5ff"
                  emissive="#00e5ff"
                  emissiveIntensity={0.8}
                  roughness={0.2}
                  metalness={0.5}
                  side={THREE.DoubleSide}
                />
              </mesh>
            );

          case 'mega':
            return (
              <group key={id} position={[x, p.y + 0.02, z]} rotation={[-Math.PI / 2, 0, p.yaw]}>
                <mesh>
                  <planeGeometry args={[2.2, 2.6]} />
                  <meshStandardMaterial
                    color={COLORS.RED}
                    emissive={COLORS.RED}
                    emissiveIntensity={1.2}
                    roughness={0.15}
                    metalness={0.6}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                <mesh position={[0, 0, 0.01]}>
                  <ringGeometry args={[0.8, 1.1, 24]} />
                  <meshStandardMaterial
                    color={COLORS.YELLOW}
                    emissive={COLORS.YELLOW}
                    emissiveIntensity={1.0}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              </group>
            );

          default:
            return null;
        }
      })}
    </group>
  );
}
