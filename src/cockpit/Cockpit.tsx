import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useLoadoutStore } from '@/hooks/useLoadout';
import { useResponsiveCockpitScale } from '@/hooks/useResponsiveCockpitScale';
import { makePolkaDotTexture } from '@/utils/proceduralTextures';
import { CockpitCamera } from './CockpitCamera';
import { CockpitDamageFX } from './CockpitDamageFX';
import { CockpitHood } from './CockpitHood';
import { CockpitSteeringWheel } from './CockpitSteeringWheel';
import { useCockpitAnimation } from './useCockpitAnimation';

/**
 * World-origin cockpit. The camera is a child of this group; the cockpit
 * never moves in world space, the WORLD (track + props) scrolls past it.
 *
 * Layout (world units):
 *   Camera at (0, 1.2, 0.6) — inside the cab, looking toward -Z
 *   Hood lives in front (-Z). Dashboard sits between camera and hood.
 *
 * Sub-components:
 *   CockpitHood          — hood mesh + chrome ridge + ornament
 *   CockpitSteeringWheel — torus rim + spokes + horn cap
 *   CockpitDamageFX      — fire point-light + smoke particles
 *   CockpitCamera        — FOV / look-ahead / speed shake
 *   useCockpitAnimation  — all per-frame transform logic
 */
export function Cockpit() {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const wheelRef = useRef<THREE.Group>(null);
  const ornamentRef = useRef<THREE.Group>(null);
  const diceRef = useRef<THREE.Group>(null);
  const rigLeftRef = useRef<THREE.Mesh>(null);
  const rigRightRef = useRef<THREE.Mesh>(null);
  const fireLightRef = useRef<THREE.PointLight>(null);
  const smokeRef0 = useRef<THREE.Mesh>(null);
  const smokeRef1 = useRef<THREE.Mesh>(null);
  const smokeRef2 = useRef<THREE.Mesh>(null);

  useCockpitAnimation({
    rootRef,
    bodyRef,
    wheelRef,
    ornamentRef,
    diceRef,
    rigLeftRef,
    rigRightRef,
    fireLightRef,
    smokeRef0,
    smokeRef1,
    smokeRef2,
  });

  const polkaTex = useMemo(() => {
    const t = makePolkaDotTexture();
    t.repeat.set(3, 2);
    return t;
  }, []);
  const dashPolkaTex = useMemo(() => {
    const t = makePolkaDotTexture();
    t.repeat.set(2, 1);
    return t;
  }, []);

  const hoodMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: polkaTex, roughness: 0.55 }),
    [polkaTex],
  );
  const dashMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: dashPolkaTex, roughness: 0.5 }),
    [dashPolkaTex],
  );
  const frameMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x9c27b0, roughness: 0.4 }),
    [],
  );
  const chromeMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.05,
        metalness: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.5,
      }),
    [],
  );
  const windshieldArchMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xffd600, roughness: 0.35, metalness: 0.2 }),
    [],
  );

  const loadout = useLoadoutStore((s) => s.loadout);

  const paletteBaseHex = useMemo(() => {
    if (!loadout) return '#ff3e3e';
    switch (loadout.palette) {
      case 'neon-circus':
        return '#0d0d0d';
      case 'pastel-dream':
        return '#ffd6e0';
      case 'golden-hour':
        return '#c8860a';
      default:
        return '#ff3e3e';
    }
  }, [loadout?.palette, loadout]);

  useMemo(() => {
    hoodMat.color.set(paletteBaseHex);
    hoodMat.needsUpdate = true;
  }, [paletteBaseHex, hoodMat]);

  const rimColor = useMemo(() => {
    if (!loadout) return '#9c27b0';
    switch (loadout.rim) {
      case 'gold':
        return '#ffd700';
      case 'purple-candy':
        return '#9c27b0';
      case 'rainbow':
        return '#ff3e3e';
      default:
        return '#cccccc';
    }
  }, [loadout?.rim, loadout]);

  const cockpitScale = useResponsiveCockpitScale();

  return (
    <group ref={rootRef} name="cockpit-root" data-testid="cockpit" scale={cockpitScale.scale}>
      {/* Rigging cables — well behind camera (z>2), visible only on drop-in */}
      <mesh ref={rigLeftRef} position={[-1.3, 8.2, 2.4]}>
        <cylinderGeometry args={[0.025, 0.025, 11.6, 6]} />
        <meshStandardMaterial color="#2a1a2f" roughness={0.8} />
      </mesh>
      <mesh ref={rigRightRef} position={[1.3, 8.2, 2.4]}>
        <cylinderGeometry args={[0.025, 0.025, 11.6, 6]} />
        <meshStandardMaterial color="#2a1a2f" roughness={0.8} />
      </mesh>

      <group ref={bodyRef} name="cockpit-body">
        <CockpitCamera />

        {/* A-pillars */}
        <mesh position={[-1.1, 1.55, -0.2]} rotation={[0.25, 0, 0.12]} material={frameMat}>
          <cylinderGeometry args={[0.05, 0.05, 1.6, 10]} />
        </mesh>
        <mesh position={[1.1, 1.55, -0.2]} rotation={[0.25, 0, -0.12]} material={frameMat}>
          <cylinderGeometry args={[0.05, 0.05, 1.6, 10]} />
        </mesh>

        {/* Windshield arch */}
        <mesh position={[0, 2.3, -0.3]} rotation={[0.15, 0, 0]} material={windshieldArchMat}>
          <torusGeometry args={[1.08, 0.07, 10, 24, Math.PI]} />
        </mesh>
        <mesh position={[0, 2.2, -0.3]} rotation={[0.15, 0, 0]} material={windshieldArchMat}>
          <boxGeometry args={[2.3, 0.1, 0.1]} />
        </mesh>

        {/* Roof sliver */}
        <mesh position={[0, 2.35, 0.4]} rotation={[-0.1, 0, 0]} material={frameMat}>
          <boxGeometry args={[2.2, 0.08, 0.5]} />
        </mesh>

        {/* Polka-dot cowl + chrome piping */}
        <mesh
          position={[0, 0.75, -0.65]}
          rotation={[-Math.PI / 2.4, 0, Math.PI / 2]}
          material={dashMat}
        >
          <cylinderGeometry args={[0.32, 0.32, 2.0, 28, 1, false, 0, Math.PI]} />
        </mesh>
        <mesh position={[0, 0.95, -0.48]} rotation={[-Math.PI / 2, 0, 0]} material={chromeMat}>
          <torusGeometry args={[0.32, 0.015, 8, 24, Math.PI]} />
        </mesh>

        <CockpitHood
          hoodMat={hoodMat}
          chromeMat={chromeMat}
          windshieldArchMat={windshieldArchMat}
          hoodZOffset={cockpitScale.hoodZOffset}
          ornamentRef={ornamentRef}
        />

        <CockpitSteeringWheel wheelRef={wheelRef} chromeMat={chromeMat} rimColor={rimColor} />

        {/* Rear-view mirror + fuzzy dice */}
        <group position={[0, 2.15, 0.2]}>
          <mesh position={[0, 0.05, 0]} material={chromeMat}>
            <cylinderGeometry args={[0.018, 0.018, 0.2, 8]} />
          </mesh>
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[0.7, 0.2, 0.05]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, -0.05, 0.035]}>
            <planeGeometry args={[0.65, 0.15]} />
            <meshStandardMaterial color="#bbb" metalness={0.95} roughness={0.05} />
          </mesh>
          <group ref={diceRef} position={[0.22, -0.18, 0.05]}>
            <mesh position={[0, -0.12, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 0.25, 6]} />
              <meshBasicMaterial color="#fff" />
            </mesh>
            <mesh position={[-0.04, -0.28, 0]} rotation={[1, 2, 3]}>
              <boxGeometry args={[0.08, 0.08, 0.08]} />
              <meshStandardMaterial color="#ff3e3e" />
            </mesh>
            <mesh position={[0.04, -0.25, 0.04]} rotation={[3, 2, 1]}>
              <boxGeometry args={[0.08, 0.08, 0.08]} />
              <meshStandardMaterial color="#00a8ff" />
            </mesh>
          </group>
        </group>

        {/* Bench seat + yellow piping */}
        <mesh position={[0, 0.9, 1.1]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[1.4, 0.12, 0.55]} />
          <meshStandardMaterial color="#c21a1a" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.94, 0.85]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.4, 12, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#ffd600" roughness={0.3} metalness={0.3} />
        </mesh>

        {/* Headlights */}
        <spotLight
          position={[-0.5, 0.2, -1.3]}
          target-position={[-0.5, -0.5, -40]}
          angle={Math.PI / 5}
          penumbra={0.55}
          intensity={3.0}
          distance={120}
          color="#ffeedd"
        />
        <spotLight
          position={[0.5, 0.2, -1.3]}
          target-position={[0.5, -0.5, -40]}
          angle={Math.PI / 5}
          penumbra={0.55}
          intensity={3.0}
          distance={120}
          color="#ffeedd"
        />
        <pointLight position={[0, 1.8, 0.3]} intensity={0.45} distance={3.5} color="#ffd6b0" />

        <CockpitDamageFX
          fireLightRef={fireLightRef}
          smokeRef0={smokeRef0}
          smokeRef1={smokeRef1}
          smokeRef2={smokeRef2}
        />
      </group>
    </group>
  );
}
