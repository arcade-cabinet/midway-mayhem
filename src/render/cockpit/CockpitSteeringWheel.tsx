/**
 * Steering wheel — chrome rim, four spokes, depressible red horn cap at the
 * hub. Input-driven rotation (left/right steer) is handled by an outer
 * animation hook; this component just declares the static geometry.
 */
const RIM = '#e8e8e8';
const SPOKE = '#c8c8c8';
const HORN_RED = '#ff3e3e';
const GOLD = '#f4c430';

export function CockpitSteeringWheel() {
  return (
    <group name="steering-wheel">
      {/* Torus rim */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.035, 12, 36]} />
        <meshStandardMaterial color={RIM} roughness={0.15} metalness={0.85} />
      </mesh>

      {/* 4 spokes */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} rotation={[0, 0, angle]}>
            <boxGeometry args={[0.04, 0.3, 0.02]} />
            <meshStandardMaterial color={SPOKE} roughness={0.2} metalness={0.85} />
          </mesh>
        );
      })}

      {/* Horn cap — red button centre, depressible in v2 */}
      <mesh position={[0, 0, 0.02]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.05, 24]} />
        <meshStandardMaterial color={HORN_RED} roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Gold ring around the horn button */}
      <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.11, 0.012, 8, 24]} />
        <meshStandardMaterial color={GOLD} roughness={0.2} metalness={0.7} />
      </mesh>

      {/* Column — cylindrical shaft going down into the dash */}
      <mesh position={[0, -0.25, -0.05]} rotation={[Math.PI / 2.5, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 0.5, 16]} />
        <meshStandardMaterial color={SPOKE} roughness={0.3} metalness={0.6} />
      </mesh>
    </group>
  );
}
