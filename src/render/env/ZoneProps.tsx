/**
 * Zone props — candy-stripe tent cones and accent-colored balloons rendered
 * as instanced meshes along both sides of the track. Scrolls with the player
 * every frame so there are always props in view without a huge draw call.
 *
 * This is an ADDITIVE layer on top of BigTopEnvironment (HDRI dome + ground).
 * Drop it as a sibling inside <BigTopEnvironment /> or inside any scene that
 * wants trackside carnival dressing.
 *
 * Ported from reference/src/game/Environment.tsx (instanced mesh section).
 * HDRI + ground live in src/render/Environment.tsx (BigTopEnvironment).
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '@/game/gameState';
import { sampleTrack } from '@/track/trackGenerator';
import { themeFor } from '@/track/zoneSystem';
import { TRACK } from '@/utils/constants';
import { makeStripeTexture } from '@/utils/proceduralTextures';

const PROP_COUNT = 80;

/**
 * Instanced tent cones and balloon spheres on both shoulders of the track.
 * Props recycle every frame around the player position — always PROP_COUNT
 * meshes total regardless of run length.
 */
export function ZoneProps() {
  const tentsRef = useRef<THREE.InstancedMesh>(null);
  const balloonsRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const stripeTex = useMemo(() => {
    const t = makeStripeTexture();
    t.repeat.set(4, 1);
    return t;
  }, []);

  const tentGeo = useMemo(() => new THREE.ConeGeometry(2, 4, 8), []);
  const balloonGeo = useMemo(() => new THREE.SphereGeometry(0.5, 10, 8), []);

  useFrame(() => {
    const s = useGameStore.getState();
    const playerD = s.distance;
    const playerSample = sampleTrack(playerD);
    const playerLat = Math.max(-10, Math.min(10, s.lateral));
    const playerWorldX = playerSample.x + playerSample.normal.x * playerLat;
    const spacing = 22;
    const start = Math.floor(playerD / spacing) * spacing - 40;

    const tents = tentsRef.current;
    const balloons = balloonsRef.current;
    if (!tents || !balloons) return;

    for (let i = 0; i < PROP_COUNT; i++) {
      const d = start + i * spacing;
      const sample = sampleTrack(d);
      const side = i % 2 === 0 ? -1 : 1;
      const offset = (TRACK.WIDTH * 0.5 + 4 + (i % 3) * 2.5) * side;
      const worldX = sample.x + sample.normal.x * offset - playerWorldX;
      const worldZ = -(d - playerD) + sample.normal.z * offset;
      const dy = sample.y - playerSample.y;

      dummy.position.set(worldX, dy + 1, worldZ);
      dummy.rotation.set(0, (i * 0.37) % Math.PI, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tents.setMatrixAt(i, dummy.matrix);

      dummy.position.set(
        worldX + side * 1.5,
        dy + 4 + Math.sin(i + performance.now() * 0.001) * 0.5,
        worldZ,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      balloons.setMatrixAt(i, dummy.matrix);
    }
    tents.instanceMatrix.needsUpdate = true;
    balloons.instanceMatrix.needsUpdate = true;
  });

  const zone = useGameStore((s) => s.currentZone);
  const theme = themeFor(zone);

  return (
    <group data-testid="zone-props">
      <instancedMesh ref={tentsRef} args={[tentGeo, undefined, PROP_COUNT]}>
        <meshStandardMaterial map={stripeTex} roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={balloonsRef} args={[balloonGeo, undefined, PROP_COUNT]}>
        <meshStandardMaterial color={theme.accent} metalness={0.4} roughness={0.15} />
      </instancedMesh>
    </group>
  );
}
