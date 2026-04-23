/**
 * PBR carnival-plank track surface material.
 *
 * Asset: PolyHaven "weathered_brown_planks" (CC0)
 * https://polyhaven.com/a/weathered_brown_planks
 * Slug: weathered_brown_planks — 1k JPG
 *
 * Three textures:
 *   public/textures/track/planks/diffuse.jpg   — baseColor / diffuse map
 *   public/textures/track/planks/normal.jpg    — OpenGL-convention normal map
 *   public/textures/track/planks/roughness.jpg — roughness map
 *
 * UV tiling rationale:
 *   Track piece dimensions: ~20 m long × 12 m wide
 *   The PolyHaven texture covers ~1.8 m² (actual survey dimension).
 *   Repeat along length (wrapT): 20 / 1.8 ≈ 11 → rounded to 12 for visual rhythm.
 *   Repeat across width  (wrapS): 12 / 1.8 ≈ 6.5 → rounded to 7.
 *
 * `buildTrackSurfaceMaterialDescriptor` is the pure-function interface
 * exercised by unit tests (no texture loading, no browser context).
 * `useTrackSurfaceMaterial` is the suspense-friendly R3F hook used by Track.tsx.
 */
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

export interface TrackSurfaceMaterialDescriptor {
  /** Paths relative to the vite public root (`/` in the browser). */
  paths: {
    diffuse: string;
    normal: string;
    roughness: string;
  };
  /** UV repeat: [wrapS (across width), wrapT (along length)]. */
  tiling: [number, number];
  roughness: number;
  metalness: number;
}

const BASE = '/textures/track/planks';

/**
 * Returns the material descriptor without loading any textures.
 * Pure function — safe to call in Node tests.
 *
 * @param fsRoot  Unused at runtime; accepted only so tests can assert the
 *                descriptor is self-contained (no runtime-only constants).
 */
export function buildTrackSurfaceMaterialDescriptor(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _fsRoot?: string,
): TrackSurfaceMaterialDescriptor {
  return {
    paths: {
      diffuse: `${BASE}/diffuse.jpg`,
      normal: `${BASE}/normal.jpg`,
      roughness: `${BASE}/roughness.jpg`,
    },
    // Planks run length-wise along the track (wrapT).  7 repeats across 12 m
    // width, 12 repeats along the 20 m piece length gives a plank board-width
    // of ~1.7 m — close to real fairground floorboards (~30 cm) but larger
    // than life, which reads better at arcade speed.
    tiling: [7, 12],
    roughness: 0.82,
    metalness: 0.0,
  };
}

/**
 * Suspense-friendly R3F hook.  Throws a Promise while textures load
 * (React Suspense protocol), so the caller must be wrapped in <Suspense>.
 *
 * On load failure, `useTexture` throws an Error that propagates through
 * the nearest ErrorBoundary (ReactErrorBoundary → errorBus → ErrorModal).
 * No fallback — hard-fail is the contract.
 */
export function useTrackSurfaceMaterial(): THREE.MeshStandardMaterial {
  const desc = buildTrackSurfaceMaterialDescriptor();

  // useTexture with an array of three paths returns [Texture, Texture, Texture].
  // We assert non-null: if any path fails, useTexture throws before we get here.
  const textures = useTexture([desc.paths.diffuse, desc.paths.normal, desc.paths.roughness]);

  const diffuse = textures[0] as THREE.Texture;
  const normal = textures[1] as THREE.Texture;
  const roughnessTex = textures[2] as THREE.Texture;

  const [repeatU, repeatV] = desc.tiling;

  for (const tex of [diffuse, normal, roughnessTex]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatU, repeatV);
    tex.anisotropy = 4;
  }

  // Diffuse is sRGB colour data; normal + roughness are linear data maps.
  diffuse.colorSpace = THREE.SRGBColorSpace;
  normal.colorSpace = THREE.LinearSRGBColorSpace;
  roughnessTex.colorSpace = THREE.LinearSRGBColorSpace;

  const mat = new THREE.MeshStandardMaterial({
    map: diffuse,
    normalMap: normal,
    roughnessMap: roughnessTex,
    roughness: desc.roughness,
    metalness: desc.metalness,
  });

  return mat;
}
