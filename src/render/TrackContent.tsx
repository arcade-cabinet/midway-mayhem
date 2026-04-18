/**
 * Renders the obstacles + pickups that live ON the track. Each entity
 * knows its own (distance, lateral) in track space; we resolve that to
 * a world-space transform using the same sampleTrackPose helper the
 * track itself uses, so everything stays perfectly on-rails.
 *
 * Rendered as children of the Track group so the parent's per-frame
 * counter-rotation sweeps them past the cockpit automatically.
 */
import { useFrame } from '@react-three/fiber';
import { useQuery } from 'koota/react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { type SampledSegment, sampleTrackPose } from '@/ecs/systems/trackSampler';
import { Obstacle, Pickup, TrackSegment } from '@/ecs/traits';

/** Balloon with per-frame bob + spin. Phase seeded by position so every
 *  balloon on the track animates out of sync with its neighbours. */
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
        <meshBasicMaterial color="#ffd600" />
      </mesh>
    </group>
  );
}

const BALLOON_COLORS = ['#ff2d87', '#00e5ff', '#ffd600', '#ff6f00', '#c71585'];

export function TrackContent() {
  const trackSegs = useQuery(TrackSegment);
  const obstacles = useQuery(Obstacle);
  const pickups = useQuery(Pickup);

  const sampled: SampledSegment[] = useMemo(() => {
    const traits = trackSegs
      .map((e) => e.get(TrackSegment))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.index - b.index);
    return traits.map((seg) => ({
      startPose: {
        x: seg.startX,
        y: seg.startY,
        z: seg.startZ,
        yaw: seg.startYaw,
        pitch: seg.startPitch,
      },
      archetypeId: seg.archetype,
      length: seg.length,
      deltaYaw: seg.deltaYaw,
      deltaPitch: seg.deltaPitch,
      bank: seg.bank,
      distanceStart: seg.distanceStart,
    }));
  }, [trackSegs]);

  if (sampled.length === 0) return null;

  return (
    <group name="track-content">
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
                  <meshStandardMaterial color="#ff6f00" roughness={0.5} />
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
            // Red + white striped short wall across one lane.
            return (
              <group key={id} position={[x, p.y, z]} rotation={[0, p.yaw, 0]}>
                <mesh position={[0, 0.6, 0]}>
                  <boxGeometry args={[1.8, 1.2, 0.35]} />
                  <meshStandardMaterial color="#e53935" roughness={0.6} />
                </mesh>
                <mesh position={[0, 0.6, 0.18]}>
                  <boxGeometry args={[1.85, 0.25, 0.01]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.6} />
                </mesh>
              </group>
            );
          case 'gate':
            // Arch with side pillars — telegraphs the correct lane.
            return (
              <group key={id} position={[x, p.y, z]} rotation={[0, p.yaw, 0]}>
                <mesh position={[-1.2, 1.0, 0]}>
                  <boxGeometry args={[0.3, 2.0, 0.3]} />
                  <meshStandardMaterial color="#8e24aa" roughness={0.5} metalness={0.3} />
                </mesh>
                <mesh position={[1.2, 1.0, 0]}>
                  <boxGeometry args={[0.3, 2.0, 0.3]} />
                  <meshStandardMaterial color="#8e24aa" roughness={0.5} metalness={0.3} />
                </mesh>
                <mesh position={[0, 2.1, 0]}>
                  <boxGeometry args={[2.7, 0.35, 0.3]} />
                  <meshStandardMaterial
                    color="#ffd600"
                    emissive="#ffd600"
                    emissiveIntensity={0.4}
                    roughness={0.3}
                  />
                </mesh>
              </group>
            );
          case 'hammer':
            // Swinging carnival hammer — still head for simplicity.
            return (
              <group key={id} position={[x, p.y, z]} rotation={[0, p.yaw, 0]}>
                <mesh position={[0, 1.6, 0]}>
                  <boxGeometry args={[0.2, 2.4, 0.2]} />
                  <meshStandardMaterial color="#5d4037" roughness={0.7} />
                </mesh>
                <mesh position={[0, 0.5, 0]}>
                  <boxGeometry args={[1.4, 0.9, 1.4]} />
                  <meshStandardMaterial color="#1e88e5" roughness={0.5} metalness={0.4} />
                </mesh>
              </group>
            );
          default:
            return null;
        }
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
            // Deterministic color + phase per entity so the same balloon always
            // animates the same way across restarts.
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
            // Cyan boost pad.
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
            // Magenta mega pad — same shape as boost but hotter color +
            // pulsing emissive so it reads as a bigger reward.
            return (
              <group key={id} position={[x, p.y + 0.02, z]} rotation={[-Math.PI / 2, 0, p.yaw]}>
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
                    color="#ffd600"
                    emissive="#ffd600"
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
