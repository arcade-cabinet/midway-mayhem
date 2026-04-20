/**
 * Root App integration test — the single gate that would have caught the
 * "game doesn't even come up" regression. Mounts the real <App/>, waits
 * for the R3F Canvas to render, and asserts OBSERVABLE state the user
 * actually sees: non-zero canvas size, non-zero scene contents, center
 * pixel isn't the WebGL default clear (transparent black).
 *
 * If this test passes, the scene is live. If it fails, NOTHING else in
 * the game is running.
 */
import { render, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { diag, waitFrames } from '@/test/integration';
import { App } from './App';

describe('App root-render integration', () => {
  // canvas.toDataURL() below reads the GL drawing buffer. In prod App.tsx
  // leaves preserveDrawingBuffer off (ReadPixels stalls on swiftshader),
  // so this test opts back in via the ?preserve=1 URL flag App reads.
  beforeAll(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('preserve', '1');
    window.history.replaceState(null, '', url.toString());
  });

  it('mounts a real R3F canvas with a rendered scene', async () => {
    const { container } = render(<App />);

    // Canvas DOM element exists (created by R3F).
    const canvas = await waitFor(
      () => {
        const el = container.querySelector('canvas');
        if (!el) throw new Error('canvas not rendered');
        return el;
      },
      { timeout: 10_000 },
    );

    // Give R3F's initial measure + useEffect resize-kick (in App.tsx) a
    // handful of frames to settle. If this test fails, the Canvas never
    // got a real size → no scene, no render, canvas stays blank.
    await waitFrames(30);

    // Canvas must be larger than the WebGL default (300×150). If R3F
    // never received a real size, this is the failure mode.
    expect(canvas.width, `canvas.width was ${canvas.width}`).toBeGreaterThan(300);
    expect(canvas.height, `canvas.height was ${canvas.height}`).toBeGreaterThan(150);

    // Canvas must have a live WebGL context.
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) throw new Error('no WebGL context');
    expect(gl.isContextLost()).toBe(false);

    // Read a pixel via the 2D canvas API — going through gl.readPixels
    // after a browser present can read a cleared drawing buffer even with
    // preserveDrawingBuffer:true. toDataURL re-paints the last committed
    // image, which is what the user actually sees.
    const dataUrl = canvas.toDataURL('image/png');
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('failed to decode canvas snapshot'));
      img.src = dataUrl;
    });
    const probe = document.createElement('canvas');
    probe.width = img.width;
    probe.height = img.height;
    const ctx = probe.getContext('2d');
    if (!ctx) throw new Error('no 2d ctx');
    ctx.drawImage(img, 0, 0);
    const pix = ctx.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data;
    const sum = pix[0]! + pix[1]! + pix[2]! + pix[3]!;
    expect(
      sum,
      `pixel was rgba(${pix.join(',')}), canvas ${canvas.width}×${canvas.height}`,
    ).toBeGreaterThan(0);

    // And the diagnostics bus should report the scene has objects in it —
    // trackPieces > 0 proves procedural track geometry actually mounted,
    // not just an empty clear-coloured canvas.
    const snap = diag();
    expect(snap.trackPieces, `trackPieces was ${snap.trackPieces}`).toBeGreaterThan(0);
  });
});
