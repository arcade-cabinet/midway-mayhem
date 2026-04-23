/**
 * Renders the procedural track as geometry. Pure read from koota
 * `TrackSegment` entities → three.js buffer geometry. No loaders, no GLBs.
 *
 * Geometry layout, per segment, sampled at SEGMENT_SUBDIVISIONS+1 stations:
 *   - top surface: a quad strip laid along the full-width centreline
 *   - slab underside + side walls: extruded down by SLAB_DEPTH
 *   - lane dividers: (lanes-1) thin dashed ribbons on the top surface
 *   - edge rumble strips: alternating red/white chunks just outside the paved
 *     surface on both the left and right edges
 *
 * Banking rolls the local frame around the forward axis by `bank` (radians)
 * interpolated linearly across the segment. Yaw and pitch integrate from the
 * starting pose. Heights are applied along the bank-rotated up vector so the
 * entire slab cants into the turn as one solid body.
 *
 * Everything coalesces into a handful of draw calls (surface, underside,
 * walls, stripes, curbs-red, curbs-white) regardless of segment count.
 *
 * The track surface uses a PBR carnival-plank material loaded via
 * `useTrackSurfaceMaterial`. That hook is suspense-aware, so <Track> must
 * be wrapped in a <Suspense> boundary (done here via <TrackWithPBR>).
 * If the textures fail to load the error propagates through the nearest
 * ReactErrorBoundary → errorBus → ErrorModal. No fallback colour.
 */
import { useQuery } from 'koota/react';
import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { trackArchetypes } from '@/config';
import { integratePose, type Pose } from '@/ecs/systems/track';
import type { SampledSegment } from '@/ecs/systems/trackSampler';
import { TrackSegment } from '@/ecs/traits';
import { useTrackSurfaceMaterial } from './trackSurfaceMaterial';

const SEGMENT_SUBDIVISIONS = 12;
const SLAB_DEPTH = 0.45;
const LANE_STRIPE_WIDTH = 0.16;
const LANE_STRIPE_LIFT = 0.015;
const CURB_CHUNK_LENGTH = 2.5;
const CURB_WIDTH = 0.6;
const CURB_HEIGHT = 0.18;

interface BuiltGeo {
  surface: THREE.BufferGeometry;
  underside: THREE.BufferGeometry;
  walls: THREE.BufferGeometry;
  stripes: THREE.BufferGeometry;
  curbsRed: THREE.BufferGeometry;
  curbsWhite: THREE.BufferGeometry;
}

interface Station {
  pos: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  forward: THREE.Vector3;
}

interface SegmentInput {
  startPose: Pose;
  archetypeId: string;
  length: number;
  deltaYaw: number;
  deltaPitch: number;
  bank: number;
  startBank: number;
}

function sampleStation(startPose: Pose, seg: SegmentInput, t: number): Station {
  const arch = {
    id: seg.archetypeId,
    label: seg.archetypeId,
    length: seg.length,
    deltaYaw: seg.deltaYaw,
    deltaPitch: seg.deltaPitch,
    bank: seg.bank,
    weight: 1,
  };
  const pose = integratePose(startPose, arch, t);

  // Forward: yaw-horizontal projected with pitch (Z-negative "into screen").
  const fwd = new THREE.Vector3(
    -Math.sin(pose.yaw) * Math.cos(pose.pitch),
    Math.sin(pose.pitch),
    -Math.cos(pose.yaw) * Math.cos(pose.pitch),
  ).normalize();

  // Right (before bank): horizontal, perpendicular to yaw.
  const rightFlat = new THREE.Vector3(Math.cos(pose.yaw), 0, -Math.sin(pose.yaw));
  const upFlat = new THREE.Vector3().crossVectors(rightFlat, fwd).normalize();

  // Bank: LERP from this piece's startBank (= previous piece's endBank)
  // to its own target bank across t=[0,1]. Before this fix, bank was
  // `seg.bank * t`, which reset to 0 at every piece start — the slab
  // edges on a banked→flat transition diverged up to 3.48m, producing
  // the torn seams visible in the side-view baseline.
  const bank = seg.startBank + (seg.bank - seg.startBank) * t;
  const cosB = Math.cos(bank);
  const sinB = Math.sin(bank);
  const right = rightFlat.clone().multiplyScalar(cosB).addScaledVector(upFlat, sinB);
  const up = upFlat.clone().multiplyScalar(cosB).addScaledVector(rightFlat, -sinB);

  return {
    pos: new THREE.Vector3(pose.x, pose.y, pose.z),
    right,
    up,
    forward: fwd,
  };
}

function buildTrackGeometry(segments: SegmentInput[]): BuiltGeo {
  const lanes = trackArchetypes.lanes;
  const laneWidth = trackArchetypes.laneWidth;
  const halfWidth = (laneWidth * lanes) / 2;

  const surfacePos: number[] = [];
  const surfaceIdx: number[] = [];
  const underPos: number[] = [];
  const underIdx: number[] = [];
  const wallPos: number[] = [];
  const wallIdx: number[] = [];
  const stripePos: number[] = [];
  const stripeIdx: number[] = [];
  const curbRedPos: number[] = [];
  const curbRedIdx: number[] = [];
  const curbWhitePos: number[] = [];
  const curbWhiteIdx: number[] = [];

  // Pre-sample all segments' stations so we can emit curb chunks evenly
  // along an entire segment's path length rather than segment-locally.
  const segmentStations: Station[][] = segments.map((seg) => {
    const arr: Station[] = [];
    for (let i = 0; i <= SEGMENT_SUBDIVISIONS; i++) {
      const t = i / SEGMENT_SUBDIVISIONS;
      arr.push(sampleStation(seg.startPose, seg, t));
    }
    return arr;
  });

  const pushVec = (arr: number[], v: THREE.Vector3) => {
    arr.push(v.x, v.y, v.z);
  };

  for (let s = 0; s < segments.length; s++) {
    const stations = segmentStations[s];
    if (!stations) continue;
    const seg = segments[s];
    if (!seg) continue;

    for (let i = 0; i <= SEGMENT_SUBDIVISIONS; i++) {
      const st = stations[i];
      if (!st) continue;
      const left = st.pos.clone().addScaledVector(st.right, -halfWidth);
      const right = st.pos.clone().addScaledVector(st.right, halfWidth);
      const leftBot = left.clone().addScaledVector(st.up, -SLAB_DEPTH);
      const rightBot = right.clone().addScaledVector(st.up, -SLAB_DEPTH);

      pushVec(surfacePos, left);
      pushVec(surfacePos, right);
      pushVec(underPos, leftBot);
      pushVec(underPos, rightBot);
      pushVec(wallPos, left);
      pushVec(wallPos, leftBot);
      pushVec(wallPos, right);
      pushVec(wallPos, rightBot);

      if (i > 0) {
        const b = surfacePos.length / 3 - 4;
        surfaceIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        const u = underPos.length / 3 - 4;
        underIdx.push(u + 2, u + 1, u, u + 2, u + 3, u + 1);
        const w = wallPos.length / 3 - 8;
        // left wall — previous-top, previous-bot, cur-top, cur-bot
        wallIdx.push(w, w + 1, w + 4, w + 1, w + 5, w + 4);
        // right wall (flipped winding)
        wallIdx.push(w + 2, w + 6, w + 3, w + 3, w + 6, w + 7);
      }
    }

    // Lane dividers — build each divider as independent dashed segments
    // sampled along its own path. Dash cadence is independent of
    // SEGMENT_SUBDIVISIONS so it stays clean on short and long pieces.
    const DASH_LENGTH = 1.4;
    const GAP_LENGTH = 1.4;
    const dashCycles = Math.max(1, Math.round(seg.length / (DASH_LENGTH + GAP_LENGTH)));
    for (let d = 1; d < lanes; d++) {
      const offset = -halfWidth + d * laneWidth;
      for (let c = 0; c < dashCycles; c++) {
        const cycleT0 = c / dashCycles;
        const cycleT1 = (c + 1) / dashCycles;
        // Dash fills first DASH_LENGTH / (DASH_LENGTH+GAP_LENGTH) of cycle.
        const dashEndT = cycleT0 + (cycleT1 - cycleT0) * (DASH_LENGTH / (DASH_LENGTH + GAP_LENGTH));
        const stStart = sampleStation(seg.startPose, seg, cycleT0);
        const stEnd = sampleStation(seg.startPose, seg, dashEndT);
        const aL = stStart.pos
          .clone()
          .addScaledVector(stStart.right, offset - LANE_STRIPE_WIDTH / 2)
          .addScaledVector(stStart.up, LANE_STRIPE_LIFT);
        const aR = stStart.pos
          .clone()
          .addScaledVector(stStart.right, offset + LANE_STRIPE_WIDTH / 2)
          .addScaledVector(stStart.up, LANE_STRIPE_LIFT);
        const bL = stEnd.pos
          .clone()
          .addScaledVector(stEnd.right, offset - LANE_STRIPE_WIDTH / 2)
          .addScaledVector(stEnd.up, LANE_STRIPE_LIFT);
        const bR = stEnd.pos
          .clone()
          .addScaledVector(stEnd.right, offset + LANE_STRIPE_WIDTH / 2)
          .addScaledVector(stEnd.up, LANE_STRIPE_LIFT);
        const base = stripePos.length / 3;
        pushVec(stripePos, aL);
        pushVec(stripePos, aR);
        pushVec(stripePos, bL);
        pushVec(stripePos, bR);
        stripeIdx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }

    // Rumble-strip curbs along both edges: alternating red/white chunks
    // of ~CURB_CHUNK_LENGTH along the outside of each edge.
    const totalLen = seg.length;
    const chunkCount = Math.max(1, Math.round(totalLen / CURB_CHUNK_LENGTH));
    for (let c = 0; c < chunkCount; c++) {
      const t0 = c / chunkCount;
      const t1 = (c + 1) / chunkCount;
      const st0 = sampleStation(seg.startPose, seg, t0);
      const st1 = sampleStation(seg.startPose, seg, t1);
      const red = c % 2 === 0;
      const posArr = red ? curbRedPos : curbWhitePos;
      const idxArr = red ? curbRedIdx : curbWhiteIdx;

      for (const sign of [-1, 1] as const) {
        const inner0 = st0.pos
          .clone()
          .addScaledVector(st0.right, sign * halfWidth)
          .addScaledVector(st0.up, LANE_STRIPE_LIFT);
        const outer0 = inner0.clone().addScaledVector(st0.right, sign * CURB_WIDTH);
        const innerTop0 = inner0.clone().addScaledVector(st0.up, CURB_HEIGHT);
        const outerTop0 = outer0.clone().addScaledVector(st0.up, CURB_HEIGHT);
        const inner1 = st1.pos
          .clone()
          .addScaledVector(st1.right, sign * halfWidth)
          .addScaledVector(st1.up, LANE_STRIPE_LIFT);
        const outer1 = inner1.clone().addScaledVector(st1.right, sign * CURB_WIDTH);
        const innerTop1 = inner1.clone().addScaledVector(st1.up, CURB_HEIGHT);
        const outerTop1 = outer1.clone().addScaledVector(st1.up, CURB_HEIGHT);

        const b = posArr.length / 3;
        pushVec(posArr, innerTop0);
        pushVec(posArr, outerTop0);
        pushVec(posArr, innerTop1);
        pushVec(posArr, outerTop1);
        pushVec(posArr, inner0);
        pushVec(posArr, outer0);
        pushVec(posArr, inner1);
        pushVec(posArr, outer1);

        const topWinding = sign > 0;
        if (topWinding) {
          idxArr.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        } else {
          idxArr.push(b + 2, b + 1, b, b + 2, b + 3, b + 1);
        }
        // outer wall
        idxArr.push(b + 1, b + 5, b + 3, b + 3, b + 5, b + 7);
        // end caps (front + back)
        idxArr.push(b, b + 2, b + 4, b + 2, b + 6, b + 4);
        idxArr.push(b + 3, b + 1, b + 5, b + 3, b + 5, b + 7);
      }
    }
  }

  const make = (pos: number[], idx: number[]): THREE.BufferGeometry => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  return {
    surface: make(surfacePos, surfaceIdx),
    underside: make(underPos, underIdx),
    walls: make(wallPos, wallIdx),
    stripes: make(stripePos, stripeIdx),
    curbsRed: make(curbRedPos, curbRedIdx),
    curbsWhite: make(curbWhitePos, curbWhiteIdx),
  };
}

/**
 * Inner component: runs inside <Suspense> so `useTrackSurfaceMaterial`
 * can throw while the three JPGs are in-flight.
 */
function TrackInner() {
  const segments = useQuery(TrackSegment);
  const groupRef = useRef<THREE.Group>(null);
  const surfaceMat = useTrackSurfaceMaterial();

  const { built } = useMemo(() => {
    const traits = segments
      .map((e) => {
        const seg = e.get(TrackSegment);
        if (!seg) throw new Error('TrackSegment missing');
        return seg;
      })
      .sort((a, b) => a.index - b.index);

    // Trust the startPose persisted by the generator rather than
    // re-integrating — 80 segments of FP math compounded into a visible
    // seam otherwise.
    const data: SegmentInput[] = traits.map((seg) => ({
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
      startBank: seg.startBank,
    }));
    const sampledSegs: SampledSegment[] = traits.map((seg) => ({
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
    return {
      built: buildTrackGeometry(data),
      sampled: sampledSegs,
    };
  }, [segments]);

  // NOTE: Track used to counter-rotate its own group each frame. That
  // transform is now owned by <TrackScroller> in App.tsx, which wraps
  // Track + all other track-anchored props so they share the same
  // scrolling world. See issue #119. Track itself is now just the static
  // geometry; its ancestor TrackScroller group does the follow-camera
  // transform for the whole world.

  return (
    <group ref={groupRef}>
      <mesh geometry={built.surface} name="track-surface" material={surfaceMat} />
      <mesh geometry={built.underside} name="track-underside">
        <meshStandardMaterial color="#2a0d05" roughness={0.95} metalness={0.0} />
      </mesh>
      <mesh geometry={built.walls} name="track-walls">
        <meshStandardMaterial color="#7a2e10" roughness={0.8} metalness={0.05} />
      </mesh>
      <mesh geometry={built.stripes} name="track-stripes">
        <meshStandardMaterial
          color="#FFFFFF"
          roughness={0.35}
          emissive="#FFFFFF"
          emissiveIntensity={0.08}
        />
      </mesh>
      <mesh geometry={built.curbsRed} name="track-curbs-red">
        <meshStandardMaterial color="#E53935" roughness={0.5} metalness={0.05} />
      </mesh>
      <mesh geometry={built.curbsWhite} name="track-curbs-white">
        <meshStandardMaterial color="#F5F5F5" roughness={0.5} metalness={0.05} />
      </mesh>
    </group>
  );
}

/**
 * Public export. Wraps <TrackInner> in a Suspense boundary so the PBR
 * texture load does not block the rest of the scene — the track geometry
 * simply stays invisible until all three JPGs resolve. On error the throw
 * propagates up to the nearest ReactErrorBoundary → errorBus → ErrorModal.
 */
export function Track() {
  return (
    <Suspense fallback={null}>
      <TrackInner />
    </Suspense>
  );
}
