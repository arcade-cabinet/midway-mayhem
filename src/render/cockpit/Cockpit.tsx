/**
 * Cockpit — hand-authored clown-car interior. No blueprint JSON, no
 * procedural layout indirection: every piece is a direct R3F primitive
 * with its position/rotation spelled out here so a developer can eyeball
 * the geometry and fix what's wrong.
 *
 * Coordinate convention (driver's local frame):
 *   +X = right, +Y = up, +Z = behind driver (so -Z = forward into track)
 *   Camera at (0, 1.55, 0.6), looking at -Z.
 *
 * Identity signatures preserved (midway-mayhem DNA):
 *   red + white polka-dot hood, purple A-pillars, yellow windshield
 *   frame, red dashboard cowl, chrome steering wheel with 4 spokes +
 *   red honk cap, chrome gauges, 8-petal flower ornament on hood tip,
 *   fuzzy dice dangling from the mirror.
 */
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { DiegeticHUD } from './DiegeticHUD';
import { FlowerOrnament } from './FlowerOrnament';
import { GaugeNeedles } from './GaugeNeedles';
import { Headlights } from './Headlights';
import { HonkableHorn } from './HonkableHorn';
import { makePolkaDotTexture } from './polkaDotTexture';
import { RearViewMirror } from './RearViewMirror';
import { SteeringWheel } from './SteeringWheel';
import { useCockpitDescentPitch } from './useCockpitDescentPitch';
import { useCockpitFeel } from './useCockpitFeel';
import { type FormTier, responsiveCockpitTransform, useFormFactor } from './useFormFactor';

/** Horizontal FOV target — narrower than 88° so the scene doesn't fish-eye. */
const FIXED_HFOV_DEG = 70;

function hFovToVFov(hFovDeg: number, aspect: number): number {
  const hFov = (hFovDeg * Math.PI) / 180;
  const vFov = 2 * Math.atan(Math.tan(hFov / 2) / aspect);
  return (vFov * 180) / Math.PI;
}

interface CockpitProps {
  tier?: FormTier;
}

export function Cockpit({ tier }: CockpitProps) {
  const ff = useFormFactor();
  const active = tier ?? ff.tier;
  const { scale, hoodZOffset } = useMemo(() => responsiveCockpitTransform(active), [active]);
  const vFov = hFovToVFov(FIXED_HFOV_DEG, ff.aspect);

  const hoodTexture = useMemo(() => {
    const t = makePolkaDotTexture('#ffffff', '#c1272d', { dotsPerSide: 5 });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 1);
    return t;
  }, []);
  const dashTexture = useMemo(() => {
    const t = makePolkaDotTexture('#ffeaa7', '#c1272d', { dotsPerSide: 4 });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    return t;
  }, []);

  const feelRef = useCockpitFeel();
  const descentPitchRef = useCockpitDescentPitch();
  useFrame(() => {
    const g = feelRef.current;
    if (!g) return;
    g.rotation.x = descentPitchRef.current;
  });

  return (
    <group scale={scale} name="cockpit">
      <group ref={feelRef} name="cockpit-body">
        <PerspectiveCamera
          makeDefault
          position={[0, 1.55, 0.6]}
          rotation={[0, 0, 0]}
          fov={vFov}
          near={0.1}
          far={2000}
        />

        {/* HOOD — wide polka-dot panel sloping down from dash to tip.
            Camera y=1.55 → hood top at y=1.15 fills lower third of POV.
            Extends from z=-0.4 (just past dash) out to z=-2.6 (hood tip,
            where the flower ornament perches). */}
        <mesh name="hood" position={[0, 1.15, -1.5 + hoodZOffset]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[1.9, 0.12, 2.3]} />
          <meshStandardMaterial map={hoodTexture} roughness={0.55} metalness={0.15} />
        </mesh>

        {/* HOOD FRONT LIP — chrome bumper strip at the hood tip. */}
        <mesh name="hoodLip" position={[0, 1.05, -2.65 + hoodZOffset]}>
          <boxGeometry args={[2.0, 0.1, 0.08]} />
          <meshStandardMaterial color="#dcdcdc" roughness={0.25} metalness={0.85} />
        </mesh>

        {/* DASH COWL — raised red polka lip at the base of the windshield. */}
        <mesh name="dashCowl" position={[0, 1.4, -0.4]} rotation={[-0.4, 0, 0]}>
          <boxGeometry args={[1.8, 0.14, 0.4]} />
          <meshStandardMaterial map={dashTexture} roughness={0.6} metalness={0.1} />
        </mesh>

        {/* DASH BACK — the flat vertical face of the dashboard. */}
        <mesh name="dashBack" position={[0, 1.22, -0.2]}>
          <boxGeometry args={[1.8, 0.35, 0.08]} />
          <meshStandardMaterial color="#7a1a1d" roughness={0.7} metalness={0.05} />
        </mesh>

        {/* A-PILLARS — purple diagonal posts framing the windshield.
            Lowered so pillar mid-height crosses the camera eye-line and
            the pillars are visible in the upper corners of the POV. */}
        <mesh name="pillarLeft" position={[-1.05, 1.7, -0.3]} rotation={[-0.25, 0, 0.22]}>
          <cylinderGeometry args={[0.08, 0.08, 1.3, 12]} />
          <meshStandardMaterial color="#6b2b8a" roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh name="pillarRight" position={[1.05, 1.7, -0.3]} rotation={[-0.25, 0, -0.22]}>
          <cylinderGeometry args={[0.08, 0.08, 1.3, 12]} />
          <meshStandardMaterial color="#6b2b8a" roughness={0.4} metalness={0.3} />
        </mesh>

        {/* WINDSHIELD TOP ARCH — yellow roof-lip crossing the upper
            windshield. y=1.95 puts it ~0.4 above camera eye so it reads
            as a roof cutting across the top of the scene. */}
        <mesh name="windshieldArch" position={[0, 1.95, -0.3]} rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[2.2, 0.1, 0.15]} />
          <meshStandardMaterial color="#ffcc29" roughness={0.35} metalness={0.4} />
        </mesh>

        {/* SIDE DOOR PANELS — red polka interior flanking the driver.
            Angled inward so they catch the eye at the edge of vision. */}
        <mesh name="doorLeft" position={[-1.1, 1.25, 0.2]} rotation={[0, 0.3, 0]}>
          <boxGeometry args={[0.08, 1.3, 1.6]} />
          <meshStandardMaterial map={hoodTexture} roughness={0.6} metalness={0.1} />
        </mesh>
        <mesh name="doorRight" position={[1.1, 1.25, 0.2]} rotation={[0, -0.3, 0]}>
          <boxGeometry args={[0.08, 1.3, 1.6]} />
          <meshStandardMaterial map={hoodTexture} roughness={0.6} metalness={0.1} />
        </mesh>

        <FlowerOrnament />
        <GaugeNeedles />
        <RearViewMirror />
        <Headlights />
        <HonkableHorn />
        <SteeringWheel />
      </group>

      <DiegeticHUD />
    </group>
  );
}
