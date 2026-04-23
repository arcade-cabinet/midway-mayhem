/**
 * Render-level continuity gate.
 *
 * Pose continuity is already asserted by
 * src/ecs/systems/track.continuity.test.ts (endPose[i] === startPose[i+1]).
 * But the render in Track.tsx samples stations with bank = seg.bank * t —
 * at t=1 of segment i the right-vector is rotated by `bank_i`, at t=0 of
 * segment i+1 the right-vector is rotated by 0. Even when the pose is
 * continuous, the left/right edge points of the slab can diverge across
 * a segment boundary — that shows up as a torn seam in the side-view
 * baseline PNG.
 *
 * This test mirrors the exact logic in Track.tsx `sampleStation` and
 * asserts that the slab-edge world-space points at station[SUB] of
 * segment i coincide with station[0] of segment i+1 within ε for every
 * pair in the canonical run.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { trackArchetypes } from '@/config';
import { generateTrack, integratePose, type Pose } from '@/ecs/systems/track';

function sampleEdges(
  startPose: Pose,
  seg: ReturnType<typeof generateTrack>[number],
  startBank: number,
  t: number,
) {
  const arch = {
    id: seg.archetype.id,
    label: seg.archetype.id,
    length: seg.archetype.length,
    deltaYaw: seg.archetype.deltaYaw,
    deltaPitch: seg.archetype.deltaPitch,
    bank: seg.archetype.bank,
    weight: 1,
  };
  const pose = integratePose(startPose, arch, t);
  const fwd = new THREE.Vector3(
    -Math.sin(pose.yaw) * Math.cos(pose.pitch),
    Math.sin(pose.pitch),
    -Math.cos(pose.yaw) * Math.cos(pose.pitch),
  ).normalize();
  const rightFlat = new THREE.Vector3(Math.cos(pose.yaw), 0, -Math.sin(pose.yaw));
  const upFlat = new THREE.Vector3().crossVectors(rightFlat, fwd).normalize();
  const bank = startBank + (seg.archetype.bank - startBank) * t;
  const cosB = Math.cos(bank);
  const sinB = Math.sin(bank);
  const right = rightFlat.clone().multiplyScalar(cosB).addScaledVector(upFlat, sinB);
  const halfWidth = (trackArchetypes.laneWidth * trackArchetypes.lanes) / 2;
  const center = new THREE.Vector3(pose.x, pose.y, pose.z);
  return {
    left: center.clone().addScaledVector(right, -halfWidth),
    right: center.clone().addScaledVector(right, halfWidth),
  };
}

const EDGE_MATCH_TOL_M = 1e-6;

describe('track render-level seam continuity', () => {
  for (const seed of [42, 7, 1337]) {
    it(`seed ${seed}: slab-edge points at station[SUB] match station[0] of the next piece`, () => {
      const segs = generateTrack(seed);
      const violations: string[] = [];
      for (let i = 0; i < segs.length - 1; i++) {
        const cur = segs[i]!;
        const next = segs[i + 1]!;
        const curStartBank = i > 0 ? segs[i - 1]!.archetype.bank : 0;
        const nextStartBank = cur.archetype.bank;
        const curEnd = sampleEdges(cur.startPose, cur, curStartBank, 1);
        const nextStart = sampleEdges(next.startPose, next, nextStartBank, 0);
        const dLeft = curEnd.left.distanceTo(nextStart.left);
        const dRight = curEnd.right.distanceTo(nextStart.right);
        if (dLeft > EDGE_MATCH_TOL_M || dRight > EDGE_MATCH_TOL_M) {
          violations.push(
            `i=${i}: ${cur.archetype.id}→${next.archetype.id} leftΔ=${dLeft.toExponential(2)}m rightΔ=${dRight.toExponential(2)}m`,
          );
        }
      }
      expect(violations, violations.join('; ')).toEqual([]);
    });
  }
});
