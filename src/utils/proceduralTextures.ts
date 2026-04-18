import * as THREE from 'three';

/** Red base with yellow + blue polka dots — the clown-car livery. */
export function makePolkaDotTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d ctx');
  ctx.fillStyle = '#ff3e3e';
  ctx.fillRect(0, 0, 512, 512);
  const radius = 30;
  const spacing = 128;
  for (let y = 0; y <= 512; y += spacing) {
    for (let x = 0; x <= 512; x += spacing) {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#00a8ff';
      ctx.beginPath();
      ctx.arc(x + spacing / 2, y + spacing / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Red/white candy stripes for carnival arches. */
export function makeStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d ctx');
  for (let i = 0; i < 512; i += 64) {
    ctx.fillStyle = (i / 64) % 2 === 0 ? '#d32f2f' : '#ffffff';
    ctx.fillRect(i, 0, 64, 512);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Sandy track with scattered noise + painted center dashes.
 * Pass a seeded `rand` function for deterministic output; defaults to Math.random.
 */
export function makeTrackTexture(rand: () => number = Math.random): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d ctx');
  ctx.fillStyle = '#e6c288';
  ctx.fillRect(0, 0, 512, 1024);
  ctx.fillStyle = '#d2a668';
  for (let i = 0; i < 8000; i++) {
    ctx.fillRect(rand() * 512, rand() * 1024, rand() * 6, rand() * 3);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let y = 0; y < 1024; y += 128) ctx.fillRect(246, y, 20, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** White-faced gauge with text + tick marks. */
export function makeGaugeTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d ctx');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 32px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 80);
  ctx.translate(128, 128);
  for (let i = 0; i < 10; i++) {
    ctx.fillRect(-3, -110, 6, 20);
    ctx.rotate(Math.PI / 5);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
