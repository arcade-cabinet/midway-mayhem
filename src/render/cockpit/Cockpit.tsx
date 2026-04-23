/**
 * Cockpit — the inside-the-clown-car view. Renders from the typed
 * {@link cockpitBlueprint} (src/config/cockpit-blueprint.json) produced by
 * the Blender prototype in Phase 1 of the cockpit hero pass. No more
 * hand-authored JSX meshes — geometry + materials live in data.
 *
 * Identity signatures (MUST preserve — these define "midway mayhem"):
 *   polka-dot hood + dashboard cowl, purple A-pillars, yellow windshield
 *   arch, red bench seat, chrome wheel with 4 spokes + red honk cap,
 *   chrome LAUGHS + FUN gauges, 8-petal flower ornament on hood tip,
 *   fuzzy dice dangling from the mirror.
 *
 * Scaling: responds to form-factor hook, uniform scale so collision feel
 * stays consistent. Hood Z-offset is applied to the hood mesh only so
 * narrow viewports can push the hood further forward without shrinking
 * the whole cockpit.
 *
 * Camera: parented inside the cockpit group (positioned at driver's eye).
 * FOV responds to aspect ratio so horizontal FOV stays stable across form
 * factors — vertical FOV just absorbs the aspect change.
 */
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { cockpitBlueprint } from '@/config';
import { CockpitMeshNode } from './blueprintMesh';
import { DiegeticHUD } from './DiegeticHUD';
import { FlowerOrnament, isFlowerMesh } from './FlowerOrnament';
import { GaugeNeedles, isGaugeNeedleMesh } from './GaugeNeedles';
import { Headlights } from './Headlights';
import { HonkableHorn, isHonkableMesh } from './HonkableHorn';
import { isMirrorGlassMesh, RearViewMirror } from './RearViewMirror';
import { isWheelMesh, SteeringWheel } from './SteeringWheel';
import { useCockpitDescentPitch } from './useCockpitDescentPitch';
import { useCockpitFeel } from './useCockpitFeel';
import { type FormTier, responsiveCockpitTransform, useFormFactor } from './useFormFactor';

const FIXED_HFOV_DEG = cockpitBlueprint.cameraFov.horizontalDeg;

function hFovToVFov(hFovDeg: number, aspect: number): number {
  const hFov = (hFovDeg * Math.PI) / 180;
  const vFov = 2 * Math.atan(Math.tan(hFov / 2) / aspect);
  return (vFov * 180) / Math.PI;
}

interface CockpitProps {
  /** Override form factor (for tests). When omitted, uses window size. */
  tier?: FormTier;
}

export function Cockpit({ tier }: CockpitProps) {
  const ff = useFormFactor();
  const active = tier ?? ff.tier;
  const { scale, hoodZOffset } = useMemo(() => responsiveCockpitTransform(active), [active]);

  const vFov = hFovToVFov(FIXED_HFOV_DEG, ff.aspect);

  // Pull the meshes in deterministic order so the draw-call list is stable
  // across renders and the scene-graph gate in Cockpit.browser.test.tsx
  // sees the same `hood` node every time.
  // Skip meshes that are rendered by dedicated animated components
  // (flower ornament spins; gauge needles sweep with game state). The
  // blueprint is still the source of truth for their geometry; the
  // dedicated components just own the animation.
  const meshEntries = useMemo(
    () =>
      Object.entries(cockpitBlueprint.meshes)
        .filter(
          ([name]) =>
            !isFlowerMesh(name) &&
            !isGaugeNeedleMesh(name) &&
            !isMirrorGlassMesh(name) &&
            !isHonkableMesh(name) &&
            !isWheelMesh(name),
        )
        .sort(([a], [b]) => a.localeCompare(b)),
    [],
  );

  // The feel group is the one that rolls/yaws/bobs with driving state.
  // Camera lives inside it, so the camera rides the body's motion — the
  // driver's head tracks the clown car's sway.
  const feelRef = useCockpitFeel();

  // Descent pitch — additive rotation-X on the body group so the hood
  // dips into a plunge and floats up on a climb, layered on top of the
  // roll/yaw/bob from useCockpitFeel.
  const descentPitchRef = useCockpitDescentPitch();
  useFrame(() => {
    const group = feelRef.current;
    if (!group) return;
    group.rotation.x = descentPitchRef.current;
  });

  return (
    <group scale={scale} name="cockpit">
      <group ref={feelRef} name="cockpit-body">
        <PerspectiveCamera
          makeDefault
          position={cockpitBlueprint.cameraPosition}
          rotation={[0, 0, 0]}
          fov={vFov}
          near={cockpitBlueprint.cameraFov.near}
          far={cockpitBlueprint.cameraFov.far}
        />

        {meshEntries.map(([name, mesh]) => {
          const material = cockpitBlueprint.materials[mesh.materialRef];
          if (!material) {
            throw new Error(
              `cockpit blueprint: mesh "${name}" references unknown material "${mesh.materialRef}"`,
            );
          }
          // The hood's Z is the one mesh that form-factor scaling nudges —
          // narrow viewports push it forward so the track stays visible.
          // Other meshes honor the blueprint position verbatim.
          if (name === 'hood' && mesh.position) {
            const [x, y, z] = mesh.position;
            const nudged = {
              ...mesh,
              position: [x, y, z + hoodZOffset] as [number, number, number],
            };
            return <CockpitMeshNode key={name} name={name} mesh={nudged} material={material} />;
          }
          return <CockpitMeshNode key={name} name={name} mesh={mesh} material={material} />;
        })}

        {/* Spinning 8-petal flower ornament on the hood tip. Its component
            rotates the assembly around Y each frame. */}
        <FlowerOrnament />

        {/* LAUGHS + FUN gauge needles, sweeping live with sanity / hype. */}
        <GaugeNeedles />

        {/* Drei MeshReflectorMaterial-backed rear-view mirror. The frame
            + stem + dice are still plain blueprint meshes; only the glass
            plane gets the reflective material. */}
        <RearViewMirror />

        {/* Two warm-white SpotLights mounted at the hood corners — paint
            cones of light on the track ahead. Inside the body group so
            the lights bank into turns with the cockpit. */}
        <Headlights />

        {/* Clickable red horn cap. Click → honk + squish animation. */}
        <HonkableHorn />

        {/* Steering wheel rim + hub + spokes rotate with steer input. */}
        <SteeringWheel />
      </group>

      {/* Diegetic HUD — speedometer + lane indicator as 3D meshes. Stays
          OUTSIDE the body-feel group so hype/damage readouts don't bob
          with engine idle; the HUD reads like it's projected on the
          windshield, not mounted on the dashboard. */}
      <DiegeticHUD />
    </group>
  );
}
