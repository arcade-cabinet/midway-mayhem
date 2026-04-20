/**
 * TrackScroller — the group that gets counter-rotated + translated each
 * frame so the cockpit (static at origin) sees the correct slice of the
 * world. Uses the exact same transform logic as Track.tsx's internal
 * useFrame (which only transforms the Track itself) — this exposes the
 * transform so that ALL track-anchored props can live inside it.
 *
 * Fixes issue #119: before this, Track.tsx counter-rotated only its own
 * mesh group, but StartPlatform / FinishBanner / ObstacleSystem /
 * BalloonLayer / FireHoopGate / BarkerCrowd / MirrorLayer / ZoneBanners
 * / GhostCar all rendered at fixed world positions. The cockpit camera
 * stays at origin, so anything placed at d≈0 appeared right in front of
 * the player forever. The visible "red slab" was StartPlatform's sign-
 * back mesh glued to the cockpit.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { type ReactNode, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { sampleTrackPose } from '@/ecs/systems/trackSampler';
import { useSampledTrack } from '@/ecs/systems/useSampledTrack';
import { Player, Position } from '@/ecs/traits';
import { world } from '@/ecs/world';
import { reportScene } from '@/game/diagnosticsBus';

// Preallocated buffers — reused each frame to avoid per-frame GC churn
// (reportScene runs in useFrame so this fires every tick).
const cameraPosTuple: [number, number, number] = [0, 0, 0];
const worldScrollerPosTuple: [number, number, number] = [0, 0, 0];
const cameraWorldPos = new THREE.Vector3();

export function TrackScroller({ children }: { children: ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const sampled = useSampledTrack();
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  // Install __mm.enumerateMeshes() + __mm.dumpScene() on mount. The two
  // helpers differ in shape: enumerateMeshes is a flat mesh list with
  // world-space bboxes (great for finding mystery geometry by color); the
  // dumpScene tree preserves parent-child relationships + LOCAL transforms
  // (great for diagnosing "which group isn't moving" like the hood-swallow
  // + TrackScroller-didn't-mount debugging in #119 / #134).
  useEffect(() => {
    // biome-ignore lint/suspicious/noExplicitAny: dev handle on window
    const w = window as any;
    if (!w.__mm) return;
    w.__mm.enumerateMeshes = () => {
      const out: Array<Record<string, unknown>> = [];
      const bbox = new THREE.Box3();
      const center = new THREE.Vector3();
      scene.traverse((o) => {
        // biome-ignore lint/suspicious/noExplicitAny: duck-typed
        const mesh = o as any;
        if (!mesh.isMesh) return;
        bbox.setFromObject(mesh);
        bbox.getCenter(center);
        const color = mesh.material?.color?.getHexString?.() ?? null;
        out.push({
          name: mesh.name || '(unnamed)',
          center: [center.x, center.y, center.z],
          size: [bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y, bbox.max.z - bbox.min.z],
          color,
          visible: mesh.visible,
        });
      });
      return out;
    };
    w.__mm.dumpScene = (maxDepth = 4) => {
      // biome-ignore lint/suspicious/noExplicitAny: duck-typed tree
      const walk = (o: any, depth: number): any => {
        const node: Record<string, unknown> = {
          name: o.name || '(unnamed)',
          type: o.type,
          visible: o.visible,
          pos: [round(o.position.x), round(o.position.y), round(o.position.z)],
          rot: [round(o.rotation.x), round(o.rotation.y), round(o.rotation.z)],
        };
        if (o.scale && (o.scale.x !== 1 || o.scale.y !== 1 || o.scale.z !== 1)) {
          node.scale = [round(o.scale.x), round(o.scale.y), round(o.scale.z)];
        }
        if (o.isMesh) {
          const color = o.material?.color?.getHexString?.() ?? null;
          if (color) node.color = color;
        }
        if (depth >= maxDepth && o.children.length > 0) {
          node.children = `<${o.children.length} hidden — raise maxDepth>`;
        } else if (o.children.length > 0) {
          node.children = o.children.map((c: unknown) => walk(c, depth + 1));
        }
        return node;
      };
      const round = (n: number) => Math.round(n * 1000) / 1000;
      return walk(scene, 0);
    };
    return () => {
      w.__mm.enumerateMeshes = undefined;
      w.__mm.dumpScene = undefined;
    };
  }, [scene]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    if (sampled.length === 0) return;
    const players = world.query(Player, Position);
    if (players.length === 0) return;
    const first = players[0];
    if (!first) return;
    const pos = first.get(Position);
    if (!pos) return;

    const p = sampleTrackPose(sampled, pos.distance);
    const rightX = Math.cos(p.yaw);
    const rightZ = -Math.sin(p.yaw);
    const ax = p.x + rightX * pos.lateral;
    const ay = p.y;
    const az = p.z + rightZ * pos.lateral;

    // Counter-rotate by the pose's yaw + pitch so "forward" along the
    // track becomes -z in world space, matching the cockpit camera.
    g.rotation.set(-p.pitch, -p.yaw, 0, 'YXZ');
    const negAnchor = new THREE.Vector3(-ax, -ay, -az);
    negAnchor.applyEuler(g.rotation);
    g.position.copy(negAnchor);
    g.updateMatrixWorld();

    // Count track pieces authoritatively from the ECS-sampled track —
    // not scene.getObjectByName('track'), which returns null (no object
    // is named 'track'). `sampled.length` IS the composed piece count,
    // which is what the diag bus should report.
    const trackPieces = sampled.length;
    // meshesRendered = every mesh currently drawable under the scroller.
    let meshesRendered = 0;
    g.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) meshesRendered++;
    });
    // Mutate preallocated tuples in place — avoid per-frame allocation.
    camera.getWorldPosition(cameraWorldPos);
    cameraPosTuple[0] = cameraWorldPos.x;
    cameraPosTuple[1] = cameraWorldPos.y;
    cameraPosTuple[2] = cameraWorldPos.z;
    worldScrollerPosTuple[0] = g.position.x;
    worldScrollerPosTuple[1] = g.position.y;
    worldScrollerPosTuple[2] = g.position.z;
    reportScene({
      trackPieces,
      meshesRendered,
      cameraPos: cameraPosTuple,
      worldScrollerPos: worldScrollerPosTuple,
    });
  });

  return <group ref={groupRef}>{children}</group>;
}
