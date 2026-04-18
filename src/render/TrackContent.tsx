/**
 * Renders the obstacles + pickups that live ON the track. Each entity
 * knows its own (distance, lateral) in track space; we resolve that to
 * a world-space transform using sampleTrackPose via useSampledTrack.
 *
 * Canonical path A: TrackContent owns all obstacle + pickup visuals.
 * seedContent (ECS) is the sole spawn source. ObstacleSystem.tsx and
 * PickupSystem.tsx are kept in place as non-mounting re-export shells so
 * nothing breaks if another module imports from them.
 *
 * Obstacle mesh styles ported from the orphan ObstacleSystem (GLB-free
 * primitive equivalents matching the COLORS palette from constants.ts).
 * Critter obstacles render as a 3-box cluster (body + two stumps) in
 * per-kind brand colors; honk scare-flee is wired via the Obstacle trait.
 * Hammer swing is animated per-frame using the baked swingPhase.
 */
import { useFrame } from '@react-three/fiber';
import { useQuery } from 'koota/react';
import { useRef } from 'react';
import * as THREE from 'three';
import { sampleTrackPose } from '@/ecs/systems/trackSampler';
import { useSampledTrack } from '@/ecs/systems/useSampledTrack';
import { Obstacle, Pickup, type ObstacleKind } from '@/ecs/traits';
import { COLORS, HONK, type CritterKind } from '@/utils/constants';

// ─── Critter palette — one color per animal ─────────────────────────────────

const CRITTER_COLORS: Record<CritterKind, string> = {
  cow: '#f5f5f5', // white
  horse: '#8b4513', // saddlebrown
  llama: '#deb887', // burlywood
  pig: '#ffb6c1', // lightpink
};

// ─── Balloon colors (matches BalloonLayer palette) ───────────────────────────

const BALLOON_COLORS = ['#ff2d87', '#00e5ff', '#ffd600', '#ff6f00', '#c71585'];

// ─── BobbingBalloon ──────────────────────────────────────────────────────────

/** Balloon with per-frame bob + spin. Phase seeded by entity id. */
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

// ─── AnimatedHammer ──────────────────────────────────────────────────────────

/** Swinging carnival hammer. Uses baked swingPhase for per-hammer offset. */
function AnimatedHammer({
  position,
  yaw,
  swingPhase,
}: {
  position: [number, number, number];
  yaw: number;
  swingPhase: number;
}) {
  const headRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!headRef.current) return;
    headRef.current.rotation.z = Math.sin(clock.elapsedTime * 2 + swingPhase) * 0.5;
  });
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* handle */}
      <mesh position={[0, 1.6, 0]}>
        <boxGeometry args={[0.2, 2.4, 0.2]} />
        <meshStandardMaterial color="#5d4037" roughness={0.7} />
      </mesh>
      {/* head — pivots on Z */}
      <mesh ref={headRef} position={[0, 0.5, 0]}>
        <boxGeometry args={[1.4, 0.9, 1.4]} />
        <meshStandardMaterial color={COLORS.BLUE} roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  );
}

// ─── AnimatedCritter ─────────────────────────────────────────────────────────

/** 3-box cluster critter that wiggles and can flee when honked. */
function AnimatedCritter({
  position,
  yaw,
  critterKind,
  phase,
  fleeing,
}: {
  position: [number, number, number];
  yaw: number;
  critterKind: CritterKind;
  phase: number;
  fleeing: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const color = CRITTER_COLORS[critterKind];
  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    // Idle bobble
    g.position.y = position[1] + Math.abs(Math.sin(clock.elapsedTime * 3 + phase)) * 0.06;
    // Panicked waggle when fleeing
    if (fleeing) {
      g.rotation.y = yaw + Math.sin(clock.elapsedTime * 12 + phase) * 0.4;
    } else {
      g.rotation.y = yaw + Math.sin(clock.elapsedTime * 1.5 + phase) * 0.08;
    }
  });
  return (
    <group ref={groupRef} position={position}>
      {/* body */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.7, 0.55, 0.45]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {/* head */}
      <mesh position={[0.38, 0.55, 0]}>
        <boxGeometry args={[0.35, 0.32, 0.35]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* tail nub */}
      <mesh position={[-0.42, 0.3, 0]}>
        <boxGeometry args={[0.12, 0.12, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    </group>
  );
}

// ─── Obstacle render helpers ─────────────────────────────────────────────────

function renderObstacle(
  id: number,
  kind: ObstacleKind,
  x: number,
  y: number,
  z: number,
  yaw: number,
  critterKind: CritterKind | '',
  fleeing: boolean,
  swingPhase: number,
): React.ReactNode {
  switch (kind) {
    case 'cone':
      return (
        <group key={id} position={[x, y, z]} rotation={[0, yaw, 0]}>
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
        <mesh key={id} position={[x, y + 0.01, z]} rotation={[-Math.PI / 2, 0, yaw]}>
          <circleGeometry args={[1.4, 16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.4} />
        </mesh>
      );
    case 'barrier':
      return (
        <group key={id} position={[x, y, z]} rotation={[0, yaw, 0]}>
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
        <group key={id} position={[x, y, z]} rotation={[0, yaw, 0]}>
          <mesh position={[-1.2, 1.0, 0]}>
            <boxGeometry args={[0.3, 2.0, 0.3]} />
            <meshStandardMaterial
              color={COLORS.PURPLE}
              roughness={0.5}
              metalness={0.3}
            />
          </mesh>
          <mesh position={[1.2, 1.0, 0]}>
            <boxGeometry args={[0.3, 2.0, 0.3]} />
            <meshStandardMaterial
              color={COLORS.PURPLE}
              roughness={0.5}
              metalness={0.3}
            />
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
          position={[x, y, z]}
          yaw={yaw}
          swingPhase={swingPhase}
        />
      );
    case 'critter': {
      const ck = (critterKind || 'cow') as CritterKind;
      const phase = (id * 0.57) % (Math.PI * 2);
      return (
        <AnimatedCritter
          key={id}
          position={[x, y, z]}
          yaw={yaw}
          critterKind={ck}
          phase={phase}
          fleeing={fleeing}
        />
      );
    }
    default:
      return null;
  }
}

// ─── TrackContent ─────────────────────────────────────────────────────────────

export function TrackContent() {
  const sampled = useSampledTrack();
  const obstacles = useQuery(Obstacle);
  const pickups = useQuery(Pickup);

  // Flush the stale hammerHeadRefs map on unmount (HMR safety).
  // No cleanup needed in prod since TrackContent is mounted for the app lifetime.

  if (sampled.length === 0) return null;

  return (
    <group name="track-content">
      {obstacles.map((e) => {
        const ob = e.get(Obstacle);
        if (!ob || ob.consumed) return null;
        // Critters that are fully off-track (fled) should stop rendering.
        // fleeing starts at fleeStartedAt > 0; after FLEE_DURATION_S they're gone.
        if (ob.kind === 'critter' && ob.fleeStartedAt > 0) {
          const elapsed = (performance.now() - ob.fleeStartedAt) / 1000;
          if (elapsed > HONK.FLEE_DURATION_S + 0.5) return null;
        }
        const p = sampleTrackPose(sampled, ob.distance);
        const rightX = Math.cos(p.yaw);
        const rightZ = -Math.sin(p.yaw);

        let lateralOffset = ob.lateral;
        // Apply flee lateral displacement for critters that are running away.
        if (ob.kind === 'critter' && ob.fleeStartedAt > 0 && ob.fleeDir !== 0) {
          const elapsed = (performance.now() - ob.fleeStartedAt) / 1000;
          const tHop = Math.min(1, elapsed / HONK.FLEE_DURATION_S);
          const eased = 1 - (1 - tHop) ** 3;
          lateralOffset = ob.lateral + ob.fleeDir * HONK.FLEE_LATERAL_M * eased;
          if (elapsed > HONK.FLEE_DURATION_S) {
            lateralOffset += ob.fleeDir * (elapsed - HONK.FLEE_DURATION_S) * 6;
          }
        }

        const x = p.x + rightX * lateralOffset;
        const z = p.z + rightZ * lateralOffset;
        const id = e.id();
        const fleeing = ob.kind === 'critter' && ob.fleeStartedAt > 0;
        return renderObstacle(
          id,
          ob.kind,
          x,
          p.y,
          z,
          p.yaw,
          ob.critterKind,
          fleeing,
          ob.swingPhase,
        );
      })}
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
              <group
                key={id}
                position={[x, p.y + 0.02, z]}
                rotation={[-Math.PI / 2, 0, p.yaw]}
              >
                <mesh>
                  <planeGeometry args={[2.2, 2.6]} />
                  <meshStandardMaterial
                    color="#ff2d87"
                    emissive="#ff2d87"
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
