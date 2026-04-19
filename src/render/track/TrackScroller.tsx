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
import { useFrame } from '@react-three/fiber';
import { type ReactNode, useRef } from 'react';
import * as THREE from 'three';
import { sampleTrackPose } from '@/ecs/systems/trackSampler';
import { useSampledTrack } from '@/ecs/systems/useSampledTrack';
import { Player, Position } from '@/ecs/traits';
import { world } from '@/ecs/world';

export function TrackScroller({ children }: { children: ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const sampled = useSampledTrack();

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
