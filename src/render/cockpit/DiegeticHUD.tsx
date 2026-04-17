/**
 * Diegetic HUD — 3D meshes inside the cockpit that READ the player's
 * current Speed + Position from the ECS world each frame. No 2D overlay.
 *
 * Speedometer: big MPH digits above the steering wheel, mounted on the
 * dashboard chrome strip so it reads as part of the car.
 *
 * Lane indicator: a row of four small lane badges (pill shapes) above
 * the speedometer. The lane the player is currently in lights up yellow;
 * other lanes stay dim.
 */
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useWorld } from 'koota/react';
import { useRef } from 'react';
import type * as THREE from 'three';
import { trackArchetypes } from '@/config';
import { Player, Position, Speed } from '@/ecs/traits';

const YELLOW = '#ffd600';
const DIM = '#38204a';
const CHROME = '#f5f5f5';

const MPS_TO_MPH = 2.23694;

export function DiegeticHUD() {
  const world = useWorld();
  const speedRef = useRef<THREE.Group>(null);
  const laneRefs = useRef<(THREE.Mesh | null)[]>([]);
  const speedTextRef = useRef<THREE.Object3D & { text?: string }>(null);

  useFrame(() => {
    const players = world.query(Player, Speed, Position);
    if (players.length === 0) return;
    const first = players[0];
    if (!first) return;
    const speed = first.get(Speed);
    const pos = first.get(Position);
    if (!speed || !pos) return;

    // Update speedometer text
    const mph = Math.round(speed.value * MPS_TO_MPH);
    const t = speedTextRef.current;
    if (t && 'text' in t) {
      const padded = mph.toString().padStart(3, '0');
      if (t.text !== padded) t.text = padded;
    }

    // Compute which lane the player is in. Lateral goes from -halfWidth to
    // +halfWidth; we divide into `lanes` bands.
    const lanes = trackArchetypes.lanes;
    const halfW = (trackArchetypes.laneWidth * lanes) / 2;
    const norm = (pos.lateral + halfW) / (halfW * 2);
    const lane = Math.min(lanes - 1, Math.max(0, Math.floor(norm * lanes)));
    for (let i = 0; i < laneRefs.current.length; i++) {
      const m = laneRefs.current[i];
      if (!m) continue;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (i === lane) {
        mat.color.set(YELLOW);
        mat.emissive.set(YELLOW);
        mat.emissiveIntensity = 0.6;
      } else {
        mat.color.set(DIM);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      }
    }
  });

  return (
    <group name="diegetic-hud">
      {/* Speedometer digits, floating just above the dashboard chrome strip */}
      <group ref={speedRef} position={[0, 1.3, -0.5]} rotation={[-0.2, 0, 0]}>
        <Text
          ref={speedTextRef as never}
          fontSize={0.28}
          color={YELLOW}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          000
        </Text>
        <Text
          fontSize={0.09}
          color={CHROME}
          anchorX="center"
          anchorY="top"
          position={[0, -0.18, 0]}
        >
          MPH
        </Text>
      </group>

      {/* Lane indicator row — 4 pill badges above the speedometer */}
      <group position={[0, 1.55, -0.5]} rotation={[-0.2, 0, 0]}>
        {Array.from({ length: trackArchetypes.lanes }, (_, i) => {
          const lanes = trackArchetypes.lanes;
          const spacing = 0.18;
          const x = (i - (lanes - 1) / 2) * spacing;
          return (
            <mesh
              key={i}
              ref={(m) => {
                laneRefs.current[i] = m;
              }}
              position={[x, 0, 0]}
            >
              <boxGeometry args={[0.14, 0.04, 0.03]} />
              <meshStandardMaterial color={DIM} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
