/**
 * Procedural track surface texture — adds grit + roughness variation so the
 * track doesn't read as flat plastic. Generated once at module import, used
 * as both the albedo variation + roughness map for meshStandardMaterial.
 *
 * The orange Hot Wheels color lives in the mesh material tint; this texture
 * modulates it with subtle noise.
 */
import * as THREE from 'three';

const SIZE = 512;

function makeNoiseCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('trackTexture: 2d context unavailable');
  // Base warm color wash
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, SIZE, SIZE);
  // Sprinkle noise dots at varying sizes + gray levels for asphalt feel.
  for (let i = 0; i < 22_000; i++) {
    const g = 180 + Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    const r = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.arc(Math.random() * SIZE, Math.random() * SIZE, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Larger blotches for macro variation
  for (let i = 0; i < 400; i++) {
    const g = 140 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgba(${g},${g},${g},0.35)`;
    const r = 6 + Math.random() * 18;
    ctx.beginPath();
    ctx.arc(Math.random() * SIZE, Math.random() * SIZE, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

let cached: THREE.CanvasTexture | null = null;

export function getTrackTexture(): THREE.CanvasTexture {
  if (cached) return cached;
  const canvas = makeNoiseCanvas();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.repeat.set(4, 24);
  cached = tex;
  return tex;
}
