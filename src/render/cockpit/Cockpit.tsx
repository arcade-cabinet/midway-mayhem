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
      {/* Angle down ~10° so we see the road ahead, hood in bottom third,
          windshield arch framing the top of the view — classic arcade
          driver framing. */}
      <PerspectiveCamera
        makeDefault
        position={[0, 1.5, 0]}
        rotation={[-0.18, 0, 0]}
        fov={vFov}
        near={0.1}
        far={2000}
      />

      {/* Cabin shell — individual walls, NOT a sealed box. Leaving the
          FRONT open so we see through the windshield at the track beyond.
          Purple interior so peripheral glances read as inside-the-car. */}
      {/* Ceiling */}
      <mesh position={[0, 2.3, 0]} rotation={[Math.PI / 2, 0, 0]} name="cabin-ceiling">
        <planeGeometry args={[3.2, 3.4]} />
        <meshStandardMaterial color={PURPLE} roughness={0.6} metalness={0.15} side={THREE.DoubleSide} />
      </mesh>
      {/* Floor */}
      <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} name="cabin-floor">
        <planeGeometry args={[3.2, 3.4]} />
        <meshStandardMaterial color="#2b0440" roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      {/* Left + right side walls */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[side * 1.6, 1.0, 0]}
          rotation={[0, side * -Math.PI / 2, 0]}
          name={`cabin-wall-${side > 0 ? 'right' : 'left'}`}
        >
          <planeGeometry args={[3.4, 2.6]} />
          <meshStandardMaterial color={PURPLE} roughness={0.6} metalness={0.15} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Back wall (behind driver) */}
      <mesh position={[0, 1.0, 1.7]} rotation={[0, Math.PI, 0]} name="cabin-back">
        <planeGeometry args={[3.2, 2.6]} />
        <meshStandardMaterial color={PURPLE} roughness={0.6} metalness={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* A-pillars — left + right windshield frames (visible through
          peripheral vision on the sides). */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[side * 1.3, 1.35, -1.1]}
          rotation={[0.18, 0, side * -0.05]}
          name={`a-pillar-${side > 0 ? 'right' : 'left'}`}
        >
          <boxGeometry args={[0.18, 1.5, 0.18]} />
          <meshStandardMaterial color={PURPLE} roughness={0.4} metalness={0.3} />
        </mesh>
      ))}

      {/* Windshield arch — yellow half-torus crowning the view */}
      <mesh position={[0, 1.95, -1.3]} rotation={[0, 0, 0]} name="windshield-arch">
        <torusGeometry args={[1.35, 0.07, 12, 28, Math.PI]} />
        <meshStandardMaterial color={YELLOW} roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Dashboard cowl — the polka-dot slab in front of driver. Top edge
          below camera horizon, back edge well in front of camera near plane
          so the cowl doesn't eclipse the whole view. */}
      <mesh position={[0, 0.95, -0.95]} rotation={[-0.15, 0, 0]} name="dashboard-cowl">
        <boxGeometry args={[2.5, 0.35, 0.8]} />
        <meshStandardMaterial map={cowlTexture} roughness={0.75} metalness={0.02} />
      </mesh>

      {/* Chrome strip along the top edge of the cowl (dividing polka-dots
          from the windshield opening). */}
      <mesh position={[0, 1.14, -0.6]} rotation={[-0.15, 0, 0]} name="dash-chrome">
        <boxGeometry args={[2.5, 0.05, 0.05]} />
        <meshStandardMaterial color={CHROME} roughness={0.1} metalness={0.95} />
      </mesh>

      {/* Bench seat behind driver (barely peripheral). */}
      <mesh position={[0, 0.45, 1.1]} name="bench-base">
        <boxGeometry args={[2.4, 0.22, 0.9]} />
        <meshStandardMaterial color={BENCH_RED} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.0, 1.5]} name="bench-back">
        <boxGeometry args={[2.4, 1.1, 0.18]} />
        <meshStandardMaterial color={BENCH_RED} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.57, 1.1]} name="bench-piping">
        <boxGeometry args={[2.45, 0.03, 0.95]} />
        <meshStandardMaterial color={YELLOW} roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Hood sits just past the windshield, high enough that the camera's
          downward tilt puts it visible in the bottom third of the frame. */}
      <group position={[0, 0.9, -2.6 + hoodZOffset]}>
        <CockpitHood />
      </group>

      {/* Steering wheel — driver's hands, in front of the cowl's back edge
          so the rim sticks up above the polka dots. */}
      <group position={[0, 1.0, -1.3]} rotation={[-0.4, 0, 0]} scale={0.9}>
        <CockpitSteeringWheel />
      </group>

      {/* Fuzzy dice dangling off the (implied) mirror above the dash. */}
      <FuzzyDice />
    </group>
  );
}

function FuzzyDice() {
  return (
    <group position={[0.9, 2.1, -1.1]} name="fuzzy-dice">
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
