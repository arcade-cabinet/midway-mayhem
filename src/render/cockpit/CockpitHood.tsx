/**
 * @deprecated — Blueprint-driven rendering (Phase 2, PR #139) owns the
 * hood now. This hand-authored variant is preserved as a reference /
 * fallback only. The live app imports nothing from this file.
 *
 * When the live hood shape changes, the source of truth is
 * `src/config/cockpit-blueprint.json` + the blueprintMesh + FlowerOrnament
 * components. Identity signatures — polka-dot livery, spinning flower,
 * gold accent, chrome ridge — are all reproduced there.
 */
import { useMemo } from 'react';
import { makePolkaDotTexture } from './polkaDotTexture';

const HOOD_BASE = '#ffe4f2';
const HOOD_DOT = '#ff2d87';
const GOLD = '#f4c430';
const CHROME = '#d8d8d8';
const PETAL = '#ff2d87';

export function CockpitHood() {
  const hoodTex = useMemo(() => {
    const t = makePolkaDotTexture(HOOD_DOT, HOOD_BASE, { dotsPerSide: 3 });
    t.repeat.set(3, 2);
    return t;
  }, []);

  return (
    <group name="hood">
      {/* Sphere squished into a hood shape — POC-tuned scale lets the hood
          span the windshield opening without swallowing camera near-plane. */}
      <mesh position={[0, 0, 0]} scale={[0.95, 0.75, 1.25]}>
        <sphereGeometry args={[0.92, 28, 20]} />
        <meshStandardMaterial map={hoodTex} roughness={0.55} metalness={0.1} />
      </mesh>

      {/* Chrome ridge up the centre line of the hood */}
      <mesh position={[0, 0.5, 0]} scale={[1, 1, 1.2]}>
        <boxGeometry args={[0.08, 0.04, 1.0]} />
        <meshStandardMaterial color={CHROME} roughness={0.1} metalness={0.95} />
      </mesh>

      {/* Gold accent line behind the ridge */}
      <mesh position={[0, 0.44, 0.1]}>
        <boxGeometry args={[0.18, 0.02, 0.8]} />
        <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Spinning 8-petal flower ornament on the front tip of the hood */}
      <FlowerOrnament />
    </group>
  );
}

function FlowerOrnament() {
  // 8 petals radial around Y axis + yellow centre sphere, positioned on
  // the front tip of the hood (-z direction) where the player sees it.
  const petalCount = 8;
  return (
    <group position={[0, 0.6, -0.75]} name="flower-ornament">
      <mesh>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.6} />
      </mesh>
      {Array.from({ length: petalCount }, (_, i) => {
        const angle = (i / petalCount) * Math.PI * 2;
        const x = Math.cos(angle) * 0.18;
        const y = Math.sin(angle) * 0.18;
        return (
          <mesh
            key={`petal-${angle.toFixed(3)}`}
            position={[x, y, 0]}
            rotation={[0, 0, angle]}
            scale={[1.4, 0.5, 0.5]}
          >
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshStandardMaterial color={PETAL} roughness={0.5} metalness={0.1} />
          </mesh>
        );
      })}
    </group>
  );
}
