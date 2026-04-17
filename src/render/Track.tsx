/**
 * Renders the procedural track as geometry. Pure read from koota
 * `TrackSegment` entities → three.js buffer geometry. No loaders, no GLBs.
 *
 * Each segment contributes:
 *   - a ribbon of quads (the road surface, lanes wide)
 *   - lane-stripe decals on the surface
 *   - raised curb strips along both edges
 *
 * Banking rolls the segment around its forward axis, yaw/pitch integrate
 * from the starting pose. Surface normals point up (pre-bank).
 */
import { useQuery } from 'koota/react';
import { useMemo } from 'react';
import * as THREE from 'three';
import { trackArchetypes } from '@/config';
import { TrackSegment } from '@/ecs/traits';
import { integratePose, type Pose } from '@/ecs/systems/track';

const SEGMENT_SUBDIVISIONS = 12;
const LANE_STRIPE_WIDTH = 0.22;

interface Built {
  geometry: THREE.BufferGeometry;
  stripes: THREE.BufferGeometry;
  curbs: THREE.BufferGeometry;
}

/**
 * Build a single buffer geometry from all TrackSegment entities. Coalesces
 * into three meshes (surface, stripes, curbs) so the scene has three draw
 * calls for the whole track, not 80×3.
 */
function buildTrackGeometry(
  segmentData: Array<{
    startPose: Pose;
    archetypeId: string;
    length: number;
    deltaYaw: number;
    deltaPitch: number;
    bank: number;
  }>,
): Built {
  const halfWidth = (trackArchetypes.laneWidth * trackArchetypes.lanes) / 2;
  const surfacePositions: number[] = [];
  const surfaceIndices: number[] = [];
  const stripePositions: number[] = [];
  const stripeIndices: number[] = [];
  const curbPositions: number[] = [];
  const curbIndices: number[] = [];

  for (const seg of segmentData) {
    const arch = {
      id: seg.archetypeId,
      label: seg.archetypeId,
      length: seg.length,
      deltaYaw: seg.deltaYaw,
      deltaPitch: seg.deltaPitch,
      bank: seg.bank,
      weight: 1,
    };
    for (let i = 0; i <= SEGMENT_SUBDIVISIONS; i++) {
      const t = i / SEGMENT_SUBDIVISIONS;
      const pose = integratePose(seg.startPose, arch, t);

      // Compute right vector (perpendicular to forward in yaw plane)
      const rightX = Math.cos(pose.yaw);
      const rightZ = -Math.sin(pose.yaw);

      // Apply banking: rotate the right vector around forward axis by `bank`.
      // For our purposes lateral Y tilt is enough: right vector pitches.
      const bankCos = Math.cos(seg.bank * t);
      const bankSin = Math.sin(seg.bank * t);

      const leftX = -rightX * halfWidth * bankCos;
      const leftZ = -rightZ * halfWidth * bankCos;
      const leftY = -halfWidth * bankSin;
      const rightRX = rightX * halfWidth * bankCos;
      const rightRZ = rightZ * halfWidth * bankCos;
      const rightRY = halfWidth * bankSin;

      // Road surface ribbon (two verts per subdivision)
      surfacePositions.push(pose.x + leftX, pose.y + leftY, pose.z + leftZ);
      surfacePositions.push(pose.x + rightRX, pose.y + rightRY, pose.z + rightRZ);

      if (i > 0) {
        const baseSurfaceIdx = surfacePositions.length / 3 - 4;
        // Two triangles per quad
        surfaceIndices.push(baseSurfaceIdx, baseSurfaceIdx + 1, baseSurfaceIdx + 2);
        surfaceIndices.push(baseSurfaceIdx + 1, baseSurfaceIdx + 3, baseSurfaceIdx + 2);
      }

      // Lane stripes — one centerline, 2 lane dividers per side for 4-lane.
      // For v2 we only render the centerline as a thin ribbon (cheap placeholder).
      stripePositions.push(pose.x - LANE_STRIPE_WIDTH * rightX, pose.y + 0.02, pose.z - LANE_STRIPE_WIDTH * rightZ);
      stripePositions.push(pose.x + LANE_STRIPE_WIDTH * rightX, pose.y + 0.02, pose.z + LANE_STRIPE_WIDTH * rightZ);
      if (i > 0) {
        const baseStripeIdx = stripePositions.length / 3 - 4;
        stripeIndices.push(baseStripeIdx, baseStripeIdx + 1, baseStripeIdx + 2);
        stripeIndices.push(baseStripeIdx + 1, baseStripeIdx + 3, baseStripeIdx + 2);
      }

      // Raised curbs — ~20cm tall block along each edge
      const curbH = 0.2;
      curbPositions.push(pose.x + leftX, pose.y + leftY, pose.z + leftZ);
      curbPositions.push(pose.x + leftX, pose.y + leftY + curbH, pose.z + leftZ);
      curbPositions.push(pose.x + rightRX, pose.y + rightRY, pose.z + rightRZ);
      curbPositions.push(pose.x + rightRX, pose.y + rightRY + curbH, pose.z + rightRZ);
      if (i > 0) {
        const baseCurbIdx = curbPositions.length / 3 - 8;
        // Left curb front face
        curbIndices.push(baseCurbIdx, baseCurbIdx + 1, baseCurbIdx + 4);
        curbIndices.push(baseCurbIdx + 1, baseCurbIdx + 5, baseCurbIdx + 4);
        // Right curb front face
        curbIndices.push(baseCurbIdx + 2, baseCurbIdx + 6, baseCurbIdx + 3);
        curbIndices.push(baseCurbIdx + 3, baseCurbIdx + 6, baseCurbIdx + 7);
      }
    }
  }

  const makeBufferGeo = (pos: number[], idx: number[]): THREE.BufferGeometry => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  return {
    geometry: makeBufferGeo(surfacePositions, surfaceIndices),
    stripes: makeBufferGeo(stripePositions, stripeIndices),
    curbs: makeBufferGeo(curbPositions, curbIndices),
  };
}

export function Track() {
  const segments = useQuery(TrackSegment);

  const built = useMemo(() => {
    const data = segments.map((e) => {
      const seg = e.get(TrackSegment);
      if (!seg) throw new Error('TrackSegment missing');
      // Re-integrate the start pose deterministically from the generator,
      // since traits only hold distanceStart + archetype data (pose is
      // derivable). In v1 we cached pose on the trait; here we keep traits
      // small and regenerate poses in memo.
      return seg;
    });
    // We don't currently carry startPose on the trait — regenerate from
    // the full generator output. To keep this renderer self-contained for
    // now, lean on the system to have spawned in index order so we can
    // integrate here.
    const sorted = [...data].sort((a, b) => a.index - b.index);
    const dataWithPose = sorted.reduce<
      Array<{
        startPose: Pose;
        archetypeId: string;
        length: number;
        deltaYaw: number;
        deltaPitch: number;
        bank: number;
      }>
    >((acc, seg) => {
      const prev = acc[acc.length - 1];
      const startPose: Pose = prev
        ? integratePose(
            prev.startPose,
            {
              id: prev.archetypeId,
              label: prev.archetypeId,
              length: prev.length,
              deltaYaw: prev.deltaYaw,
              deltaPitch: prev.deltaPitch,
              bank: prev.bank,
              weight: 1,
            },
            1,
          )
        : { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
      acc.push({
        startPose,
        archetypeId: seg.archetype,
        length: seg.length,
        deltaYaw: seg.deltaYaw,
        deltaPitch: seg.deltaPitch,
        bank: seg.bank,
      });
      return acc;
    }, []);
    return buildTrackGeometry(dataWithPose);
  }, [segments]);

  return (
    <group>
      <mesh geometry={built.geometry} name="track-surface">
        <meshStandardMaterial color="#F36F21" roughness={0.55} metalness={0.1} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={built.stripes} name="track-stripes">
        <meshStandardMaterial color="#FFD600" roughness={0.4} />
      </mesh>
      <mesh geometry={built.curbs} name="track-curbs">
        <meshStandardMaterial color="#8E24AA" roughness={0.4} />
      </mesh>
    </group>
  );
}
