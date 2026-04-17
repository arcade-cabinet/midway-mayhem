/**
 * Ghost car — semi-transparent silhouette of the best-scoring saved run,
 * playing back synced to the current run's elapsed time.
 *
 * The ghost lives in the same local space as the track. Its (distance,
 * lateral) resolve to a world pose via the shared sampleTrackPose so it
 * tracks curves + hills correctly. Since the Track group is the thing
 * being offset per-frame to keep the player at origin, the ghost is a
 * child of Track — it inherits the same world transform automatically.
 */
import { useFrame } from '@react-three/fiber';
import { useQuery } from 'koota/react';
import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { type SampledSegment, sampleTrackPose } from '@/ecs/systems/trackSampler';
import { TrackSegment } from '@/ecs/traits';
import { currentRunElapsed, type GhostRecord, loadBestGhost, sampleGhost } from '@/game/ghost';

export function GhostCar() {
  const groupRef = useRef<THREE.Group>(null);
  const ghostRef = useRef<GhostRecord | null>(null);
  const trackSegs = useQuery(TrackSegment);

  // Load once on mount so we don't hit localStorage each frame.
  if (ghostRef.current === null) {
    ghostRef.current = loadBestGhost();
  }

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

  useFrame(() => {
    const g = groupRef.current;
    const ghost = ghostRef.current;
    if (!g || !ghost || sampled.length === 0) {
      if (g) g.visible = false;
      return;
    }
    const t = currentRunElapsed();
    const s = sampleGhost(ghost, t);
    if (!s) {
      g.visible = false;
      return;
    }
    const p = sampleTrackPose(sampled, s.distance);
    const rightX = Math.cos(p.yaw);
    const rightZ = -Math.sin(p.yaw);
    g.visible = true;
    g.position.set(p.x + rightX * s.lateral, p.y + 0.7, p.z + rightZ * s.lateral);
    g.rotation.set(-p.pitch, p.yaw, 0, 'YXZ');
  });

  // Don't render a placeholder if there's no ghost to play back.
  if (ghostRef.current === null) return null;

  return (
    <group ref={groupRef} name="ghost-car" visible={false}>
      {/* Body — squished box, magenta translucent */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.4, 0.5, 2.6]} />
        <meshStandardMaterial
          color="#ff2d87"
          transparent
          opacity={0.35}
          emissive="#ff2d87"
          emissiveIntensity={0.4}
          depthWrite={false}
        />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 0.8, -0.2]}>
        <boxGeometry args={[1.0, 0.4, 1.4]} />
        <meshStandardMaterial
          color="#ff2d87"
          transparent
          opacity={0.3}
          emissive="#ff2d87"
          emissiveIntensity={0.3}
          depthWrite={false}
        />
      </mesh>
      {/* Wheels */}
      {[
        [-0.7, 0.1, -0.9],
        [0.7, 0.1, -0.9],
        [-0.7, 0.1, 0.9],
        [0.7, 0.1, 0.9],
      ].map(([x, y, z]) => (
        <mesh
          key={`wheel-${x}-${z}`}
          position={[x as number, y as number, z as number]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.2, 0.2, 0.2, 10]} />
          <meshStandardMaterial color="#111" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
