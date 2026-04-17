/**
 * Collectibles — 4 hidden horn pickups scattered around the tour.
 * Each is a procedural bulb-horn mesh (cone + sphere).
 * Walk within 1.5m to collect. Persists via profile.grantUnlock.
 * Collecting all 4 grants 'ringmasters-horn'.
 */
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { grantUnlock } from '@/persistence/profile';
import { reportError } from '@/game/errorBus';

export type ZoneCollectibleId = 'tour-strip' | 'tour-balloons' | 'tour-fire' | 'tour-funhouse';

export const COLLECTIBLE_POSITIONS: Record<ZoneCollectibleId, [number, number, number]> = {
  'tour-strip': [8, 1.0, -12],
  'tour-balloons': [-9, 1.0, -38],
  'tour-fire': [6, 1.0, -60],
  'tour-funhouse': [-7, 1.0, -82],
};

const COLLECT_RADIUS = 1.5;
const ALL_ZONES: readonly ZoneCollectibleId[] = [
  'tour-strip',
  'tour-balloons',
  'tour-fire',
  'tour-funhouse',
];

interface Props {
  /** Mutable ref updated each frame by BigTopTour with current player world position */
  playerPositionRef: React.MutableRefObject<THREE.Vector3>;
  onAllCollected: () => void;
}

export function Collectibles({ playerPositionRef, onAllCollected }: Props) {
  const [collected, setCollected] = useState<Set<ZoneCollectibleId>>(new Set());
  const allCollectedFired = useRef(false);

  const handleCollect = (id: ZoneCollectibleId) => {
    setCollected((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);

      // Persist to profile
      grantUnlock('horn_shape', id).catch((err: unknown) =>
        reportError(err, `Collectibles.grantUnlock:${id}`),
      );

      // Check all collected
      if (!allCollectedFired.current && ALL_ZONES.every((z) => next.has(z))) {
        allCollectedFired.current = true;
        grantUnlock('horn_shape', 'ringmasters-horn').catch((err: unknown) =>
          reportError(err, 'Collectibles.grantUnlock:ringmasters-horn'),
        );
        onAllCollected();
      }

      return next;
    });
  };

  return (
    <>
      {ALL_ZONES.map((id) =>
        collected.has(id) ? null : (
          <HornPickup
            key={id}
            id={id}
            position={COLLECTIBLE_POSITIONS[id]}
            playerPositionRef={playerPositionRef}
            onCollect={() => handleCollect(id)}
          />
        ),
      )}
    </>
  );
}

interface HornPickupProps {
  id: ZoneCollectibleId;
  position: [number, number, number];
  playerPositionRef: React.MutableRefObject<THREE.Vector3>;
  onCollect: () => void;
}

const _hornBallGeo = new THREE.SphereGeometry(0.18, 10, 8);
const _hornConeGeo = new THREE.CylinderGeometry(0.08, 0.22, 0.55, 10);
const _hornMat = new THREE.MeshStandardMaterial({
  color: 0xffd600,
  metalness: 0.7,
  roughness: 0.15,
  emissive: new THREE.Color(0x886600),
  emissiveIntensity: 0.5,
});

function HornPickup({ id, position, playerPositionRef, onCollect }: HornPickupProps) {
  const groupRef = useRef<THREE.Group>(null);
  const collected = useRef(false);
  const worldPos = useRef(new THREE.Vector3(...position));

  useFrame(({ clock }) => {
    if (collected.current || !groupRef.current) return;

    // Bob and spin
    const t = clock.elapsedTime;
    groupRef.current.position.y = position[1] + Math.sin(t * 2) * 0.12;
    groupRef.current.rotation.y = t * 1.5;

    // Proximity check
    const dist = playerPositionRef.current.distanceTo(worldPos.current);
    if (dist < COLLECT_RADIUS) {
      collected.current = true;
      onCollect();
    }
  });

  return (
    <group ref={groupRef} position={position} name={`horn-pickup-${id}`}>
      {/* Bulb (sphere) */}
      <mesh geometry={_hornBallGeo} material={_hornMat} position={[0, 0.25, 0]} />
      {/* Bell (cone) */}
      <mesh geometry={_hornConeGeo} material={_hornMat} position={[0, -0.05, 0]} />
    </group>
  );
}
