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

export function TrackScroller({ children }: { children: ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const sampled = useSampledTrack();
  const scene = useThree((s) => s.scene);

  // Install __mm.enumerateMeshes() on mount — scene introspection helper
  // for ad-hoc devtools debugging. Returns name / world-bbox / color per
  // mesh.
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
    return () => {
      w.__mm.enumerateMeshes = undefined;
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
  });

  return <group ref={groupRef}>{children}</group>;
}
