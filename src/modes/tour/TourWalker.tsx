/**
 * @module modes/tour/TourWalker
 *
 * First-person camera controller for BigTopTour.
 * Drives the R3F camera via useFrame — no DOM, no HTML overlay.
 * Extracted from BigTopTour.tsx to keep that file under 300 LOC.
 */
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Zone trigger table lives here so Walker can do proximity checks
// without needing BigTopTour to thread a prop.
export const ZONE_TRIGGERS: ReadonlyArray<{
  id: 'midway-strip' | 'balloon-alley' | 'ring-of-fire' | 'funhouse-frenzy';
  position: THREE.Vector3;
  radius: number;
}> = [
  { id: 'midway-strip', position: new THREE.Vector3(0, 1.7, -20), radius: 6 },
  { id: 'balloon-alley', position: new THREE.Vector3(-4, 1.7, -50), radius: 6 },
  { id: 'ring-of-fire', position: new THREE.Vector3(4, 1.7, -75), radius: 6 },
  { id: 'funhouse-frenzy', position: new THREE.Vector3(-4, 1.7, -100), radius: 6 },
];

export interface WalkerProps {
  walkState: React.MutableRefObject<{
    forward: number;
    right: number;
    lookYaw: number;
    lookPitch: number;
  }>;
  playerPositionRef: React.MutableRefObject<THREE.Vector3>;
  onZoneTrigger: (id: string) => void;
}

const WALK_SPEED = 6.0; // m/s
const _fwd = new THREE.Vector3();
const _rgt = new THREE.Vector3();

export function TourWalker({ walkState, playerPositionRef, onZoneTrigger }: WalkerProps) {
  const { camera } = useThree();

  useFrame((_, dt) => {
    const s = walkState.current;

    // Apply look (YXZ order prevents gimbal lock for FPS camera)
    camera.rotation.order = 'YXZ';
    camera.rotation.y = s.lookYaw;
    camera.rotation.x = s.lookPitch;

    // Movement in yaw-plane (ignore pitch for forward direction)
    const yaw = s.lookYaw;
    _fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    _rgt.set(Math.cos(yaw), 0, -Math.sin(yaw));

    const step = WALK_SPEED * dt;
    camera.position.addScaledVector(_fwd, s.forward * step);
    camera.position.addScaledVector(_rgt, s.right * step);
    camera.position.y = 1.7; // fixed eye height

    playerPositionRef.current.copy(camera.position);

    for (const trigger of ZONE_TRIGGERS) {
      if (camera.position.distanceTo(trigger.position) < trigger.radius) {
        onZoneTrigger(trigger.id);
      }
    }
  });

  return null;
}
