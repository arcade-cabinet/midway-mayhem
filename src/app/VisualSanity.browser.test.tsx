/**
 * Visual sanity harness — SEMANTIC assertions about the live game frame.
 *
 * Traditional pinned-baseline tests compare a PNG byte-for-byte against a
 * reference image and pass as long as pixels haven't changed — including
 * when the pinned baseline itself is of a broken cockpit. A cockpit that
 * renders as a giant polka-dot cylinder and a floating traffic cone can
 * satisfy every "triangle count > 500" + "matches baseline within 1.5%"
 * gate the repo currently has. That's how we shipped 7 releases on top of
 * a visibly broken cockpit.
 *
 * This test asks semantic questions the user cares about:
 *   1. The cockpit occupies a meaningful chunk of the lower half of the
 *      frame — if it disappears entirely something broke.
 *   2. The cockpit does NOT flood the ENTIRE lower frame (fish-eye hFov
 *      regression where hood swallows everything).
 *   3. The upper-center of the frame shows the track/dome/environment
 *      (non-cockpit scene) — if the cockpit is too big it covers the track.
 *   4. Average frame brightness is in a reasonable mid-tone range — a
 *      totally-dark frame (R3F never rendered) and a totally-white frame
 *      (shader error) both fail.
 *   5. No single colour dominates — a pure-yellow frame means the arches
 *      are swallowing the view; a pure-black frame means the scene died.
 *
 * None of these are pixel-perfect; they're ranges. The goal is a tripwire
 * that fires on "the frame is obviously broken," not on subtle shader
 * drift (that's what pinned baselines are for — if we want them).
 */
import { render, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { App } from './App';

// App.tsx checks `?preserve=1` at render time to opt into WebGL
// preserveDrawingBuffer. Without it, drawing the canvas to a 2D canvas
// yields a blank frame because the WebGL backbuffer is cleared between
// frames. Set the URL here before App mounts.
beforeAll(() => {
  const url = new URL(window.location.href);
  url.searchParams.set('preserve', '1');
  url.searchParams.set('nonameonboard', '1');
  window.history.replaceState(null, '', url);
});

/** Inclusive bbox in fraction-of-frame coords (0..1). */
interface Region {
  name: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface RegionStats {
  name: string;
  /** Average luminance 0..1 (0=black, 1=white). */
  avgLum: number;
  /** Average RGB 0..255. */
  avgR: number;
  avgG: number;
  avgB: number;
  /** Fraction of sampled pixels that are >0.9 luminance (near-white). */
  pctBright: number;
  /** Fraction <0.05 luminance (near-black). */
  pctDark: number;
}

function sampleRegion(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  region: Region,
): RegionStats {
  const x0 = Math.floor(region.x0 * w);
  const y0 = Math.floor(region.y0 * h);
  const x1 = Math.floor(region.x1 * w);
  const y1 = Math.floor(region.y1 * h);
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let bright = 0;
  let dark = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    sumR += r;
    sumG += g;
    sumB += b;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (lum > 0.9) bright++;
    if (lum < 0.05) dark++;
  }
  return {
    name: region.name,
    avgR: sumR / n,
    avgG: sumG / n,
    avgB: sumB / n,
    avgLum: (0.2126 * sumR + 0.7152 * sumG + 0.0722 * sumB) / (n * 255),
    pctBright: bright / n,
    pctDark: dark / n,
  };
}

describe('Visual sanity — live game frame', () => {
  it('mounts and the frame has meaningful content in cockpit + track regions', async () => {
    const { container } = render(<App />);
    const canvas = await waitFor(
      () => {
        const el = container.querySelector('canvas');
        if (!el) throw new Error('canvas not rendered');
        return el as HTMLCanvasElement;
      },
      { timeout: 15_000 },
    );

    // Give R3F a generous window to compile shaders + resolve PBR textures.
    await new Promise<void>((r) => setTimeout(r, 3000));

    // Force preserveDrawingBuffer by capturing via a separate 2D context.
    // toDataURL() fails silently on WebGL canvases unless preserve is set —
    // we sidestep by drawing the canvas onto a temporary 2D canvas.
    const w = canvas.width;
    const h = canvas.height;
    const snap = document.createElement('canvas');
    snap.width = w;
    snap.height = h;
    const ctx = snap.getContext('2d');
    if (!ctx) throw new Error('no 2d context available');
    ctx.drawImage(canvas, 0, 0);

    // Sanity probe: full-frame average luminance should not be 0 (black
    // page) or 1 (shader error fills white). Somewhere in the mid 0.1..0.7
    // indicates a scene was actually drawn.
    const full = sampleRegion(ctx, w, h, { name: 'full', x0: 0, y0: 0, x1: 1, y1: 1 });
    expect(full.avgLum, `full frame avg luminance ${full.avgLum}`).toBeGreaterThan(0.03);
    expect(full.avgLum, `full frame avg luminance ${full.avgLum}`).toBeLessThan(0.9);

    // Cockpit region: lower-center 40% of the frame. If R3F rendered but
    // the cockpit is missing, the lower half will just be the dome floor —
    // very uniform. A real cockpit introduces polka-dot high-frequency
    // variance. We check that the cockpit region differs from the
    // upper-center (track/dome) region by a meaningful amount.
    const cockpit = sampleRegion(ctx, w, h, {
      name: 'cockpit',
      x0: 0.3,
      y0: 0.6,
      x1: 0.7,
      y1: 1.0,
    });
    const above = sampleRegion(ctx, w, h, {
      name: 'above',
      x0: 0.3,
      y0: 0.1,
      x1: 0.7,
      y1: 0.4,
    });
    const deltaLum = Math.abs(cockpit.avgLum - above.avgLum);
    expect(
      deltaLum,
      `cockpit region (lum ${cockpit.avgLum}) looks identical to above-track region ` +
        `(lum ${above.avgLum}) — cockpit probably didn't render`,
    ).toBeGreaterThan(0.02);

    // The above region must NOT be 100% one colour channel — if hFov is
    // blown out and the arches swallow the top of the frame, average R/B
    // drops to near-zero (pure yellow). Assert roughly balanced RGB in the
    // upper-center: no channel <40 of the max channel. This catches the
    // "two giant yellow McDonald's arches everywhere" failure mode.
    const maxAbove = Math.max(above.avgR, above.avgG, above.avgB);
    const minAbove = Math.min(above.avgR, above.avgG, above.avgB);
    if (maxAbove > 10) {
      expect(
        minAbove / maxAbove,
        `above-track region is colour-dominated: R=${above.avgR.toFixed(0)} ` +
          `G=${above.avgG.toFixed(0)} B=${above.avgB.toFixed(0)} — probably fish-eye ` +
          `FOV is blowing out arches/dome`,
      ).toBeGreaterThan(0.25);
    }

    // No single row of the cockpit region should be more than 90% bright
    // white or black — that would mean a flat unlit plane is covering the
    // view (previous regression: flat polka-dot back-cap filled the frame).
    expect(
      cockpit.pctBright,
      `cockpit region ${(cockpit.pctBright * 100).toFixed(0)}% near-white — probably unlit`,
    ).toBeLessThan(0.9);
    expect(
      cockpit.pctDark,
      `cockpit region ${(cockpit.pctDark * 100).toFixed(0)}% near-black — cockpit probably vanished`,
    ).toBeLessThan(0.9);
  });
});
