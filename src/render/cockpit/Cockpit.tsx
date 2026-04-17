/**
 * Cockpit — the inside-the-clown-car view. Everything lives inside one group
 * at world origin; the *world track* scrolls past this static cockpit, which
 * eliminates a whole class of camera-follow glitches from the POC.
 *
 * Identity signatures (MUST preserve — these define "midway mayhem" visually):
 *   - Polka-dot dashboard cowl (pink dots on cream)
 *   - Polka-dot hood (hot pink on cream)
 *   - Purple A-pillars + frame
 *   - Yellow windshield arch + bench piping
 *   - Red bench seat
 *   - Chrome steering wheel hardware
 *   - Honkable red horn cap
 *   - Spinning 8-petal flower hood ornament
 *   - Fuzzy dice dangling off the mirror
 *
 * Scaling: responds to form-factor hook, uniform scale so collision feel
 * stays consistent. Hood z-offset push keeps track visible on narrow
 * viewports without shrinking the whole cockpit.
 *
 * Camera: parented inside the cockpit group (positioned at driver's eye).
 * FOV responds to aspect ratio so horizontal FOV stays stable across form
 * factors — vertical FOV just absorbs the aspect change.
 */
import { PerspectiveCamera } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { CockpitHood } from './CockpitHood';
import { CockpitSteeringWheel } from './CockpitSteeringWheel';
import { DiegeticHUD } from './DiegeticHUD';
import { makePolkaDotTexture } from './polkaDotTexture';
import {
  type FormTier,
  responsiveCockpitTransform,
  useFormFactor,
} from './useFormFactor';

const PURPLE = '#9c27b0';
const YELLOW = '#ffd600';
const CHROME = '#d8d8d8';
const BENCH_RED = '#c21a1a';
const COWL_CREAM = '#fff1db';
const COWL_DOT = '#ff4fa3';

/**
 * Horizontal FOV the arcade-cabinet POC dialled in as "inside a clown car
 * but you can still see the track". Vertical FOV is derived from this given
 * the viewport aspect.
 */
const FIXED_HFOV_DEG = 88;

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
  const { scale, hoodZOffset } = useMemo(
    () => responsiveCockpitTransform(active),
    [active],
  );

  const cowlTexture = useMemo(() => {
    const t = makePolkaDotTexture(COWL_DOT, COWL_CREAM, { dotsPerSide: 3 });
    t.repeat.set(2, 1);
    return t;
  }, []);

  const vFov = hFovToVFov(FIXED_HFOV_DEG, ff.aspect);

  return (
    <group scale={scale} name="cockpit">
      {/*
        Frame of reference (all +y = up, -z = forward / toward track):
          camera eye      (0, 1.5, 0)   — driver's head
          steering wheel  (0, 0.85, -0.6)
          dashboard cowl  top edge ~y=1.1, runs from z=-1.0 to z=-0.4
          windshield arch (0, 1.75, -1.4)  — above cowl, in front of driver
          hood            (0, 0.5, -3.0)   — well beyond windshield
          A-pillars       frame the windshield at x=±1.3, y=1.0..1.9
          bench seat      behind driver at z=+0.6
      */}
      {/* Camera lives at driver's eye, BEHIND cockpit origin (+z). Everything
          else — hood, arch, wheel — positioned at negative z. Coordinates
          anchored to the POC's tuned values so track + hood read correctly. */}
      <PerspectiveCamera
        makeDefault
        position={[0, 1.72, 1.55]}
        rotation={[0, 0, 0]}
        fov={vFov}
        near={0.1}
        far={2000}
      />

      {/*
        COORDINATE ANCHORS (from POC-tuned values, camera at [0, 1.72, 1.55]):
          hood          [0, -0.1, -1.9]   just past windshield, below eye
          dashboard     [0, 0.75, -0.65]  cylinder rotated π/2 on Z for cowl
          steering wheel[0, 0.82, 0.2]    close to camera, reachable
          arch          [0, 2.3, -0.3]    frames windshield top
          A-pillars     [±1.1, 1.55, -0.2]
          ornament      [0, 0.5, -2.65]   on hood tip
      */}

      {/* Cabin shell — purple back wall + side walls + ceiling. Open front
          so we see the track through the windshield. */}
      <mesh position={[0, 1.2, 2.2]} rotation={[0, Math.PI, 0]} name="cabin-back">
        <planeGeometry args={[3.2, 2.8]} />
        <meshStandardMaterial color={PURPLE} roughness={0.6} metalness={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2.6, 0]} rotation={[Math.PI / 2, 0, 0]} name="cabin-ceiling">
        <planeGeometry args={[3.2, 4.0]} />
        <meshStandardMaterial color={PURPLE} roughness={0.6} metalness={0.15} side={THREE.DoubleSide} />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[side * 1.6, 1.2, 0]}
          rotation={[0, side * -Math.PI / 2, 0]}
          name={`cabin-wall-${side > 0 ? 'right' : 'left'}`}
        >
          <planeGeometry args={[4.0, 2.8]} />
          <meshStandardMaterial color={PURPLE} roughness={0.6} metalness={0.15} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* A-pillars — flank the windshield */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[side * 1.1, 1.55, -0.2]}
          rotation={[0.25, 0, side * -0.12]}
          name={`a-pillar-${side > 0 ? 'right' : 'left'}`}
        >
          <cylinderGeometry args={[0.05, 0.05, 1.8, 10]} />
          <meshStandardMaterial color={PURPLE} roughness={0.4} metalness={0.3} />
        </mesh>
      ))}

      {/* Windshield arch — standard "arch" shape: the half-torus ends
          point DOWN and midpoint crests UP at ~y = 2.7. Positioned high
          enough that it crowns the windshield without obscuring the road. */}
      <mesh
        position={[0, 1.75, -0.8]}
        rotation={[0.1, 0, 0]}
        name="windshield-arch"
      >
        <torusGeometry args={[0.95, 0.05, 10, 28, Math.PI]} />
        <meshStandardMaterial color={YELLOW} roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Dashboard cowl — cylinder rotated 90° on Z so it presents a flat
          top face to the camera. Polka dots facing up. */}
      <mesh
        position={[0, 0.75, -0.65]}
        rotation={[-Math.PI / 2.4, 0, Math.PI / 2]}
        name="dashboard-cowl"
      >
        <cylinderGeometry args={[0.32, 0.32, 2.0, 24, 1, true]} />
        <meshStandardMaterial map={cowlTexture} roughness={0.75} metalness={0.02} side={THREE.DoubleSide} />
      </mesh>

      {/* Chrome accent along the top rear edge of the cowl */}
      <mesh position={[0, 1.08, -0.5]} rotation={[-0.2, 0, 0]} name="dash-chrome">
        <boxGeometry args={[2.0, 0.05, 0.04]} />
        <meshStandardMaterial color={CHROME} roughness={0.1} metalness={0.95} />
      </mesh>

      {/* Bench seat behind driver */}
      <mesh position={[0, 0.35, 1.4]} name="bench-base">
        <boxGeometry args={[2.2, 0.22, 0.85]} />
        <meshStandardMaterial color={BENCH_RED} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.95, 1.85]} name="bench-back">
        <boxGeometry args={[2.2, 1.1, 0.18]} />
        <meshStandardMaterial color={BENCH_RED} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.47, 1.4]} name="bench-piping">
        <boxGeometry args={[2.25, 0.03, 0.9]} />
        <meshStandardMaterial color={YELLOW} roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Hood sits just past the windshield at the POC-tuned position. */}
      <group position={[0, -0.1, -1.9 + hoodZOffset]}>
        <CockpitHood />
      </group>

      {/* Steering wheel in driver's hands. Positioned high enough that the
          rim crests above the dashboard top and into the windshield view. */}
      <group position={[0, 1.05, -0.2]} rotation={[-Math.PI / 5, 0, 0]} scale={0.9}>
        <CockpitSteeringWheel />
      </group>

      {/* Fuzzy dice dangling off the (implied) mirror above the dash */}
      <FuzzyDice />

      {/* Diegetic HUD — speedometer + lane indicator as 3D meshes */}
      <DiegeticHUD />
    </group>
  );
}

function FuzzyDice() {
  return (
    <group position={[0.8, 2.1, -0.5]} name="fuzzy-dice">
      <mesh position={[-0.15, -0.45, 0]} rotation={[0.2, 0.3, 0.1]}>
        <boxGeometry args={[0.18, 0.18, 0.18]} />
        <meshStandardMaterial color="#e53935" roughness={0.9} />
      </mesh>
      <mesh position={[0.15, -0.55, 0]} rotation={[-0.15, -0.2, 0.1]}>
        <boxGeometry args={[0.18, 0.18, 0.18]} />
        <meshStandardMaterial color="#1e88e5" roughness={0.9} />
      </mesh>
      {/* Strings */}
      <mesh position={[-0.15, -0.18, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.55, 6]} />
        <meshStandardMaterial color={CHROME} />
      </mesh>
      <mesh position={[0.15, -0.23, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.45, 6]} />
        <meshStandardMaterial color={CHROME} />
      </mesh>
    </group>
  );
}
