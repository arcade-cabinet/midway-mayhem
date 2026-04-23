/**
 * ZoneProps — per-zone instanced shoulder props that make each zone
 * unmistakably different at a glance.
 *
 * Zone → prop variant mapping (from zoneSystem ZONE_THEMES):
 *   midway-strip    → striped carnival tent cones (warm orange/yellow)
 *   balloon-alley   → floating spheres at varied heights (pink/purple)
 *   ring-of-fire    → emissive torus rings on posts (orange/red fire)
 *   funhouse-frenzy → flat reflective mirror panels lining both sides
 *
 * All variants use InstancedMesh so the prop count stays fixed and the
 * GPU only sees one draw call per geometry type, regardless of how many
 * props are visible. Props recycle every frame around the player position
 * so there is always a full corridor of dressing without a large draw list.
 *
 * No perf-tier branching — if instancing is too slow we fix perf, not
 * this file.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '@/game/gameState';
import { sampleTrack } from '@/track/trackGenerator';
import { themeFor } from '@/track/zoneSystem';
import { TRACK } from '@/utils/constants';
import { makeStripeTexture } from '@/utils/proceduralTextures';

/** Total instanced props per side × 2 = total in scene. */
const PROP_COUNT = 80;
const SPACING = 22; // metres between prop placements

// ─── Shared geometries (module-level, created once) ─────────────────────────
const TENT_GEO = new THREE.ConeGeometry(2, 4, 8);
const BALLOON_GEO = new THREE.SphereGeometry(0.6, 10, 8);
const HOOP_GEO = new THREE.TorusGeometry(1.8, 0.22, 12, 36);
const HOOP_POST_GEO = new THREE.CylinderGeometry(0.08, 0.08, 3.5, 6);
const MIRROR_GEO = new THREE.BoxGeometry(0.12, 2.4, 3.2);

// ─── Shared stripe texture for Midway tents ──────────────────────────────────
let _stripeTex: THREE.CanvasTexture | null = null;
function getStripeTex(): THREE.CanvasTexture {
  if (!_stripeTex) {
    _stripeTex = makeStripeTexture();
    _stripeTex.repeat.set(4, 1);
    _stripeTex.wrapS = THREE.RepeatWrapping;
    _stripeTex.wrapT = THREE.RepeatWrapping;
  }
  return _stripeTex;
}

// ─── Material factories (deterministic colour, created once per zone entry) ──
function makeTentMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map: getStripeTex(), roughness: 0.8 });
}
function makeBalloonMat(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.25 });
}
function makeHoopMat(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.0,
    roughness: 0.3,
  });
}
function makeHoopPostMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: '#1a0000', roughness: 0.7 });
}
function makeMirrorMat(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5,
    metalness: 0.95,
    roughness: 0.05,
    transparent: true,
    opacity: 0.88,
  });
}
function makeSecondaryBalloonMat(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.25 });
}

/**
 * Instanced props along both shoulders of the track. The active variant
 * is driven by the zone theme; all four instanced meshes exist in the
 * scene simultaneously but only the active variant is positioned on-screen.
 * Inactive variants are parked at y = -9999.
 */
export function ZoneProps() {
  // InstancedMesh refs — one per geometry type
  const tentsRef = useRef<THREE.InstancedMesh>(null);
  const balloonsRef = useRef<THREE.InstancedMesh>(null);
  const balloons2Ref = useRef<THREE.InstancedMesh>(null); // secondary colour balloons
  const hoopsRef = useRef<THREE.InstancedMesh>(null);
  const hoopPostsRef = useRef<THREE.InstancedMesh>(null);
  const mirrorsRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Materials — created once per component mount
  const tentMat = useMemo(() => makeTentMat(), []);
  const balloonMat = useMemo(() => makeBalloonMat('#ff2d87'), []); // brand pink
  const balloon2Mat = useMemo(() => makeSecondaryBalloonMat('#8e24aa'), []); // brand purple
  const hoopMat = useMemo(() => makeHoopMat('#f36f21'), []); // brand orange
  const hoopPostMat = useMemo(() => makeHoopPostMat(), []);
  const mirrorMat = useMemo(() => makeMirrorMat('#1e88e5'), []); // brand blue tint

  useFrame(({ clock }) => {
    const s = useGameStore.getState();
    const zone = s.currentZone;
    const theme = themeFor(zone);
    const variant = theme.propVariant;

    const playerD = s.distance;
    const playerSample = sampleTrack(playerD);
    const playerLat = Math.max(-10, Math.min(10, s.lateral));
    const playerWorldX = playerSample.x + playerSample.normal.x * playerLat;
    const start = Math.floor(playerD / SPACING) * SPACING - 40;
    const t = clock.elapsedTime;

    const tents = tentsRef.current;
    const balloons = balloonsRef.current;
    const balloons2 = balloons2Ref.current;
    const hoops = hoopsRef.current;
    const hoopPosts = hoopPostsRef.current;
    const mirrors = mirrorsRef.current;

    if (!tents || !balloons || !balloons2 || !hoops || !hoopPosts || !mirrors) return;

    // Update accent-colour materials to current zone
    if (variant === 'balloons') {
      (balloons.material as THREE.MeshStandardMaterial).color.set(theme.accent);
      (balloons2.material as THREE.MeshStandardMaterial).color.set(theme.propAccent);
    } else if (variant === 'hoops') {
      const hm = hoops.material as THREE.MeshStandardMaterial;
      hm.color.set(theme.accent);
      hm.emissive.set(theme.accent);
    } else if (variant === 'mirrors') {
      const mm = mirrors.material as THREE.MeshStandardMaterial;
      mm.color.set(theme.accent);
      mm.emissive.set(theme.propAccent);
    }

    for (let i = 0; i < PROP_COUNT; i++) {
      const d = start + i * SPACING;
      const sample = sampleTrack(d);
      const side = i % 2 === 0 ? -1 : 1;
      const edgeOffset = TRACK.WIDTH * 0.5 + 4 + (i % 3) * 2.5;
      const offset = edgeOffset * side;

      // World-space position relative to the player camera origin
      const worldX = sample.x + sample.normal.x * offset - playerWorldX;
      const worldZ = -(d - playerD) + sample.normal.z * offset;
      const dy = sample.y - playerSample.y;

      // Park all inactive variants off-screen first; only position the active one.
      const off: [number, number, number] = [0, -9999, 0];

      switch (variant) {
        case 'tents': {
          // Striped carnival tent cone
          dummy.position.set(worldX, dy + 1, worldZ);
          dummy.rotation.set(0, (i * 0.37) % Math.PI, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          tents.setMatrixAt(i, dummy.matrix);

          // Park others
          dummy.position.set(...off);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          balloons.setMatrixAt(i, dummy.matrix);
          balloons2.setMatrixAt(i, dummy.matrix);
          hoops.setMatrixAt(i, dummy.matrix);
          hoopPosts.setMatrixAt(i, dummy.matrix);
          mirrors.setMatrixAt(i, dummy.matrix);
          break;
        }

        case 'balloons': {
          // Floating sphere balloons at varied heights, gently bobbing
          const heightVariance = (i % 7) * 0.9;
          const bob = Math.sin(t * 0.9 + i * 0.7) * 0.45;

          // Primary colour balloon
          dummy.position.set(worldX, dy + 3.5 + heightVariance + bob, worldZ);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(0.9 + (i % 3) * 0.2);
          dummy.updateMatrix();
          balloons.setMatrixAt(i, dummy.matrix);

          // Secondary colour balloon offset slightly
          dummy.position.set(
            worldX + side * 1.4,
            dy + 2.2 + heightVariance * 0.7 + bob * 0.8,
            worldZ + 1.2,
          );
          dummy.scale.setScalar(0.7 + (i % 4) * 0.15);
          dummy.updateMatrix();
          balloons2.setMatrixAt(i, dummy.matrix);

          // Park others
          dummy.position.set(...off);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          tents.setMatrixAt(i, dummy.matrix);
          hoops.setMatrixAt(i, dummy.matrix);
          hoopPosts.setMatrixAt(i, dummy.matrix);
          mirrors.setMatrixAt(i, dummy.matrix);
          break;
        }

        case 'hoops': {
          // Emissive fire-ring torus on a post
          const postY = dy - 0.2;
          const ringY = dy + 2.2;

          // Post
          dummy.position.set(worldX, postY + 1.75, worldZ);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          hoopPosts.setMatrixAt(i, dummy.matrix);

          // Ring — upright, pulsing emissive scale
          const pulse = 1.0 + Math.sin(t * 2.5 + i * 0.4) * 0.08;
          dummy.position.set(worldX, ringY, worldZ);
          dummy.rotation.set(Math.PI / 2, 0, 0);
          dummy.scale.setScalar(pulse);
          dummy.updateMatrix();
          hoops.setMatrixAt(i, dummy.matrix);

          // Park others
          dummy.position.set(...off);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          tents.setMatrixAt(i, dummy.matrix);
          balloons.setMatrixAt(i, dummy.matrix);
          balloons2.setMatrixAt(i, dummy.matrix);
          mirrors.setMatrixAt(i, dummy.matrix);
          break;
        }

        case 'mirrors': {
          // Vertical reflective panel flush to the track shoulder
          // Strobe on a square-wave so the funhouse feels alive
          const strobePhase = (t * 4 + i * 0.13) % 1;
          const visible = strobePhase < 0.65; // 65% on
          // Derive yaw from the tangent vector so panels face along the track
          const trackYaw = Math.atan2(sample.tangent.x, sample.tangent.z);
          if (visible) {
            dummy.position.set(worldX, dy + 1.2, worldZ);
            dummy.rotation.set(0, trackYaw, 0);
            dummy.scale.set(1, 1, 1);
          } else {
            dummy.position.set(...off);
          }
          dummy.updateMatrix();
          mirrors.setMatrixAt(i, dummy.matrix);

          // Park others
          dummy.position.set(...off);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          tents.setMatrixAt(i, dummy.matrix);
          balloons.setMatrixAt(i, dummy.matrix);
          balloons2.setMatrixAt(i, dummy.matrix);
          hoops.setMatrixAt(i, dummy.matrix);
          hoopPosts.setMatrixAt(i, dummy.matrix);
          break;
        }

        default: {
          // Exhaustive guard — TypeScript will catch unhandled variants at compile time.
          const _exhaustive: never = variant;
          throw new Error(`ZoneProps: unhandled propVariant "${String(_exhaustive)}"`);
        }
      }
    }

    tents.instanceMatrix.needsUpdate = true;
    balloons.instanceMatrix.needsUpdate = true;
    balloons2.instanceMatrix.needsUpdate = true;
    hoops.instanceMatrix.needsUpdate = true;
    hoopPosts.instanceMatrix.needsUpdate = true;
    mirrors.instanceMatrix.needsUpdate = true;
  });

  return (
    <group data-testid="zone-props">
      {/* Midway Strip: striped tent cones */}
      <instancedMesh ref={tentsRef} args={[TENT_GEO, tentMat, PROP_COUNT]} />

      {/* Balloon Alley: two-tone floating sphere balloons */}
      <instancedMesh ref={balloonsRef} args={[BALLOON_GEO, balloonMat, PROP_COUNT]} />
      <instancedMesh ref={balloons2Ref} args={[BALLOON_GEO, balloon2Mat, PROP_COUNT]} />

      {/* Ring of Fire: emissive torus rings on posts */}
      <instancedMesh ref={hoopsRef} args={[HOOP_GEO, hoopMat, PROP_COUNT]} />
      <instancedMesh ref={hoopPostsRef} args={[HOOP_POST_GEO, hoopPostMat, PROP_COUNT]} />

      {/* Funhouse Frenzy: strobing mirror panels */}
      <instancedMesh ref={mirrorsRef} args={[MIRROR_GEO, mirrorMat, PROP_COUNT]} />
    </group>
  );
}
