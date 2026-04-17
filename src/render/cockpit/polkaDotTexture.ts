/**
 * Procedural polka-dot texture — the midway-mayhem signature pattern.
 * Faster than loading a PNG, trivial to retheme.
 *
 * Dots are sized so repeats look arcade-kitschy, not toy-shop cute.
 * Caller sets `repeat` on the returned texture when mapped onto a mesh.
 */
import * as THREE from 'three';

export function makePolkaDotTexture(
  fg: string,
  bg: string,
  {
    dotsPerSide = 4,
    size = 256,
    dotRadiusRatio = 0.28,
  }: { dotsPerSide?: number; size?: number; dotRadiusRatio?: number } = {},
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('polkaDotTexture: 2d context unavailable');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = fg;
  const cell = size / dotsPerSide;
  const r = cell * dotRadiusRatio;
  for (let y = 0; y < dotsPerSide; y++) {
    for (let x = 0; x < dotsPerSide; x++) {
      const cx = cell * (x + 0.5);
      const cy = cell * (y + 0.5);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
