/**
 * Renders all obstacles + pickups that live ON the track (Path A — canonical).
 *
 * Each entity knows its own (distance, lateral) in track space; we resolve
 * that to world-space via useSampledTrack + sampleTrackPose so everything
 * stays perfectly on-rails.
 *
 * Obstacles are rendered via ThemedObstacle (GLB assets from KayKit CC0),
 * replacing the old inline Three.js primitive geometry.
 * Pickups remain as Three.js primitives (no GLB needed for collectibles).
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
import { COLORS } from '@/utils/constants';
import { StaticObstacle, ThemedCritter, ThemedHammer } from './obstacles/ThemedObstacle';

// ─── Bobbing balloon sub-component (pickup, not obstacle) ───────────────────

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
            return <StaticObstacle key={id} kind="cone" position={[x, p.y, z]} yaw={p.yaw} />;

          case 'oil':
            return <StaticObstacle key={id} kind="oil" position={[x, p.y, z]} yaw={p.yaw} />;

          case 'barrier':
            return <StaticObstacle key={id} kind="barrier" position={[x, p.y, z]} yaw={p.yaw} />;

          case 'gate':
            return <StaticObstacle key={id} kind="gate" position={[x, p.y, z]} yaw={p.yaw} />;

          case 'hammer':
            return (
              <ThemedHammer
                key={id}
                position={[x, p.y, z]}
                yaw={p.yaw}
                swingPhase={ob.swingPhase}
              />
            );

          case 'critter':
            return (
              <ThemedCritter
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
