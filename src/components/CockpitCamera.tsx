import { PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../systems/gameState';

/**
 * Cockpit camera — parented inside the Cockpit body group. Per-frame:
 *   1. Recompute FOV to keep horizontal FOV fixed (responsive on resize/rotate)
 *   2. Add speed-based FOV boost for "tunnel vision" at high velocity
 *   3. lookAt a smoothed target point ahead + slightly banked into steering direction
 *
 * Spec: memory/reference_r3f_racer_camera_spec.md
 */

const BASE_H_FOV = 88; // arcade sweet spot
const FOV_SPEED_BOOST_MAX = 8; // +8° at top speed
const FOV_MIN = 50;
const FOV_MAX = 110;
const MAX_SPEED_MPS = 120;

const LOOK_DIST = 30; // meters ahead of camera (camera-local -Z)
const LOOK_DOWN = 0.2; // slight downward tilt — helps show track
const APEX_STEER_PULL = 4; // m lateral pull at max steer (into-apex effect)
const LOOKAT_LERP = 5;

export function CockpitCamera() {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const lookAtTarget = useRef(new THREE.Vector3(0, -LOOK_DOWN, -LOOK_DIST));
  const tempTarget = useMemo(() => new THREE.Vector3(), []);
  const { size } = useThree();

  useFrame((_, delta) => {
    const cam = cameraRef.current;
    if (!cam) return;

    const s = useGameStore.getState();
    const aspect = size.width / Math.max(1, size.height);

    // 1. Fixed horizontal FOV → compute vertical FOV
    const hFovRad = (BASE_H_FOV * Math.PI) / 180;
    const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) / aspect);
    let vFov = (vFovRad * 180) / Math.PI;

    // 2. Speed boost
    const speedNorm = Math.min(1, s.speedMps / MAX_SPEED_MPS);
    vFov += speedNorm * FOV_SPEED_BOOST_MAX;

    vFov = Math.max(FOV_MIN, Math.min(FOV_MAX, vFov));
    // Update aspect AND fov before rebuilding the projection matrix — otherwise
    // a stale aspect (from camera construction) leaves the viewport squished
    // after a resize / orientation flip / foldable unfold.
    const aspectChanged = Math.abs(cam.aspect - aspect) > 1e-4;
    const fovChanged = Math.abs(cam.fov - vFov) > 0.01;
    if (aspectChanged || fovChanged) {
      cam.fov = vFov;
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    }

    // 3. Look target in CAMERA-LOCAL space (cockpit at origin).
    //    We aim at a point 30m ahead (-Z), slightly below camera height (-0.2),
    //    and laterally pulled by steer (look into apex).
    const apex = s.steer * APEX_STEER_PULL;
    tempTarget.set(apex, -LOOK_DOWN, -LOOK_DIST);
    lookAtTarget.current.lerp(tempTarget, Math.min(1, delta * LOOKAT_LERP));
    cam.lookAt(lookAtTarget.current);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={BASE_H_FOV}
      near={0.1}
      far={2000}
      position={[0, 1.65, 0.9]}
    />
  );
}
