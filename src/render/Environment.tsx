/**
 * Big-top environment: circus-arena HDRI as the surrounding dome + a
 * canvas-tented ground plane. This is the "world" every other render lives
 * inside. The HDRI is full 360° × 180° immersion — not a skybox half-shell —
 * so wherever the camera looks from inside the cockpit, it sees circus fabric
 * or the ring crowd. The ground plane is warm canvas red at a slight downtilt
 * so it reads as real floor, not as infinite plane.
 *
 * Drop this into any scene that wants full arcade ambience. Component-level
 * tests render geometry against the plain dark bg and skip this — that's
 * where we want tight visual isolation on the single archetype.
 *
 * Zone-aware lights: when `zone` is supplied the ambient + directional key
 * light pick up the zone's colour palette from ZONE_THEMES. This makes each
 * zone feel visually distinct without needing a different HDRI.
 */
import { Environment as DreiEnvironment } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { themeFor } from '@/track/zoneSystem';
import type { ZoneId } from '@/utils/constants';

interface BigTopEnvironmentProps {
  /** Path to the HDRI (defaults to /hdri/circus_arena_2k.hdr). */
  hdriPath?: string;
  /** Render the HDRI as visible background (true) or only as IBL (false). */
  showBackground?: boolean;
  /** Y-height of the ground plane (usually negative, below the track). */
  groundY?: number;
  /** Skip HDRI entirely — useful in tests where drei's useEnvironment
   *  context dies inside the vitest iframe. The ground + fill lights
   *  alone are a fine visual-regression stand-in. */
  skipHdri?: boolean;
  /** Night mode: dim the ground, darken background, add cyan/magenta
   *  under-glow so the big-top reads as "after hours carnival". */
  night?: boolean;
  /**
   * Active zone — when provided the ambient + key lights lerp to the
   * zone's colour palette from ZONE_THEMES. Omit in tests or scenes
   * that don't need zone-aware lighting.
   */
  zone?: ZoneId;
}

/** Read the `?night=1` URL flag so players can toggle night mode without
 *  rebuilding. Safe to call during SSR (returns false). */
export function isNightFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const p = new URLSearchParams(window.location.search);
  return p.get('night') === '1';
}

/** Time constant for zone light crossfade (seconds to 63% of target). */
const LIGHT_TAU = 1.5;

/**
 * Big-top environment: circus-arena HDRI as the surrounding dome + a warm
 * canvas ground plane. Drop this into any scene that wants full arcade
 * ambience. Component-level tests render geometry against the plain dark
 * bg and skip this — that's where we want tight visual isolation on the
 * single archetype. Composed-track tests use `skipHdri` so the environment
 * is just ground + the scene's existing lights.
 */
export function BigTopEnvironment({
  hdriPath = `${import.meta.env.BASE_URL}hdri/circus_arena_2k.hdr`,
  showBackground = true,
  groundY = -60,
  skipHdri = false,
  night = false,
  zone,
}: BigTopEnvironmentProps) {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.PointLight>(null);
  const groundRef = useRef<THREE.Mesh>(null);

  // Crossfade zone-tinted lights every frame when a zone is active.
  useFrame((_state, dt) => {
    if (!zone) return;
    const theme = themeFor(zone);
    const k = 1 - Math.exp(-dt / LIGHT_TAU);

    const ambient = ambientRef.current;
    if (ambient) {
      const target = new THREE.Color(theme.ambientColor);
      ambient.color.lerp(target, k);
      ambient.intensity += (theme.ambientIntensity - ambient.intensity) * k;
    }

    const key = keyRef.current;
    if (key) {
      const target = new THREE.Color(theme.dirLightColor);
      key.color.lerp(target, k);
      key.intensity += (theme.dirLightIntensity - key.intensity) * k;
      const [tx, ty, tz] = theme.dirLightPos;
      key.position.x += (tx - key.position.x) * k;
      key.position.y += (ty - key.position.y) * k;
      key.position.z += (tz - key.position.z) * k;
    }

    const fill = fillRef.current;
    if (fill) {
      const target = new THREE.Color(theme.fillLightColor);
      fill.color.lerp(target, k);
      fill.intensity += (theme.fillLightIntensity - fill.intensity) * k;
    }

    const ground = groundRef.current;
    if (ground) {
      const mat = ground.material as THREE.MeshStandardMaterial;
      const target = new THREE.Color(theme.groundColor);
      mat.color.lerp(target, k);
    }
  });

  // Starting colours — use zone theme if provided, else classic big-top.
  const initTheme = zone ? themeFor(zone) : null;
  const baseGroundColor = night ? '#2a0510' : (initTheme?.groundColor ?? '#6b1410');
  const baseAmbientColor = initTheme?.ambientColor ?? (night ? '#1a0020' : '#ffd600');
  const baseAmbientIntensity = initTheme?.ambientIntensity ?? (night ? 0.2 : 0.55);
  const baseKeyColor = initTheme?.dirLightColor ?? (night ? '#330066' : '#fff4cc');
  const baseKeyIntensity = initTheme?.dirLightIntensity ?? (night ? 0.4 : 1.4);
  const baseKeyPos: [number, number, number] = initTheme?.dirLightPos ?? [6, 10, 4];
  const baseFillColor = initTheme?.fillLightColor ?? (night ? '#00e5ff' : '#f36f21');
  const baseFillIntensity = initTheme?.fillLightIntensity ?? (night ? 0.6 : 0.4);

  return (
    <>
      {skipHdri ? null : (
        <DreiEnvironment
          files={hdriPath}
          background={showBackground}
          environmentIntensity={night ? 0.35 : 1.0}
          backgroundIntensity={night ? 0.25 : 1.0}
        />
      )}
      {/* Zone-aware ambient light */}
      <ambientLight ref={ambientRef} color={baseAmbientColor} intensity={baseAmbientIntensity} />
      {/* Zone-aware key (directional) light */}
      <directionalLight
        ref={keyRef}
        color={baseKeyColor}
        intensity={baseKeyIntensity}
        position={baseKeyPos}
        castShadow={false}
      />
      {/* Zone-aware fill point light (under-glow / gimmick accent) */}
      <pointLight
        ref={fillRef}
        color={baseFillColor}
        intensity={baseFillIntensity}
        position={[0, -2, -6]}
        distance={60}
        decay={2}
      />
      {night && !zone ? (
        <>
          {/* Classic night-mode cyan/magenta underglows — only when zone
           *  override is NOT present to avoid double-lighting. */}
          <pointLight
            position={[-10, -2, -6]}
            color="#00e5ff"
            intensity={6}
            distance={40}
            decay={2}
          />
          <pointLight
            position={[10, -2, -6]}
            color="#ff2d87"
            intensity={6}
            distance={40}
            decay={2}
          />
        </>
      ) : null}
      {/* Ground plane */}
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, groundY, 0]}
        receiveShadow
      >
        <circleGeometry args={[800, 64]} />
        <meshStandardMaterial
          color={baseGroundColor}
          roughness={0.9}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}
