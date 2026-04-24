/**
 * Reusable visual-sanity assertions for live R3F frames.
 *
 * All helpers operate on a 2D CanvasRenderingContext2D that holds a
 * snapshot of the WebGL canvas (drawn via `ctx.drawImage(webglCanvas, 0,
 * 0)` after the canvas was created with `preserveDrawingBuffer: true`).
 *
 * See VisualSanity.browser.test.tsx for the rationale: pinned-PNG baselines
 * can't detect "cockpit looks broken" regressions because the reference
 * PNG is also of the broken cockpit. These helpers assert SEMANTIC frame
 * properties instead (region luminance, channel balance, etc) which fire
 * on "obviously broken" and tolerate normal pixel variation.
 */

/** Inclusive bbox in fraction-of-frame coords (0..1). */
export interface Region {
  name: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Stats for a region of the frame. */
export interface RegionStats {
  name: string;
  /** Average luminance 0..1 (0=black, 1=white). */
  avgLum: number;
  /** Average RGB 0..255. */
  avgR: number;
  avgG: number;
  avgB: number;
  /** Fraction of sampled pixels >0.9 luminance (near-white). */
  pctBright: number;
  /** Fraction <0.05 luminance (near-black). */
  pctDark: number;
  /** Pixel count sampled (width × height of region). */
  pixels: number;
}

/** Canonical regions of a gameplay frame. */
export const STANDARD_REGIONS: Record<string, Region> = {
  full: { name: 'full', x0: 0, y0: 0, x1: 1, y1: 1 },
  /** Top quarter — sky / dome ceiling / upper banners. */
  sky: { name: 'sky', x0: 0.0, y0: 0.0, x1: 1.0, y1: 0.25 },
  /** Upper-center — track ahead + dome audience. */
  above: { name: 'above', x0: 0.3, y0: 0.1, x1: 0.7, y1: 0.4 },
  /** Middle band — track surface + environment. */
  middle: { name: 'middle', x0: 0.0, y0: 0.4, x1: 1.0, y1: 0.6 },
  /** Lower-center — cockpit hood + steering. */
  cockpit: { name: 'cockpit', x0: 0.3, y0: 0.6, x1: 0.7, y1: 1.0 },
  /** Full bottom row — hood + HUD chrome. */
  bottom: { name: 'bottom', x0: 0.0, y0: 0.75, x1: 1.0, y1: 1.0 },
  /** Left edge — HUD stats panel. */
  leftHud: { name: 'leftHud', x0: 0.0, y0: 0.3, x1: 0.15, y1: 0.9 },
  /** Right edge — HUD panel (score / distance). */
  rightHud: { name: 'rightHud', x0: 0.85, y0: 0.0, x1: 1.0, y1: 0.5 },
};

/**
 * Take a snapshot of a WebGL canvas into a 2D canvas. The WebGL canvas
 * MUST have been created with `preserveDrawingBuffer: true` — use the
 * `?preserve=1` URL flag and App.tsx picks it up automatically.
 */
export function snapshotWebGL(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const snap = document.createElement('canvas');
  snap.width = canvas.width;
  snap.height = canvas.height;
  const ctx = snap.getContext('2d');
  if (!ctx) throw new Error('snapshotWebGL: no 2d context');
  ctx.drawImage(canvas, 0, 0);
  return ctx;
}

/** Sample a region of the snapshotted frame and return its stats. */
export function sampleRegion(ctx: CanvasRenderingContext2D, region: Region): RegionStats {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const x0 = Math.floor(region.x0 * w);
  const y0 = Math.floor(region.y0 * h);
  const x1 = Math.floor(region.x1 * w);
  const y1 = Math.floor(region.y1 * h);
  const rw = Math.max(1, x1 - x0);
  const rh = Math.max(1, y1 - y0);
  const data = ctx.getImageData(x0, y0, rw, rh).data;
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
    pixels: n,
  };
}

/**
 * Run the standard live-frame sanity checks: no black/white screen, cockpit
 * distinct from above-track region, no single colour channel dominating
 * the upper frame (fish-eye catch).
 *
 * Returns the stats so a test can make additional assertions.
 */
export function assertLiveFrameSanity(ctx: CanvasRenderingContext2D): Record<string, RegionStats> {
  const full = sampleRegion(ctx, STANDARD_REGIONS.full!);
  const above = sampleRegion(ctx, STANDARD_REGIONS.above!);
  const cockpit = sampleRegion(ctx, STANDARD_REGIONS.cockpit!);

  if (full.avgLum < 0.03) {
    throw new Error(`full-frame avg luminance ${full.avgLum.toFixed(3)} — scene is black`);
  }
  if (full.avgLum > 0.9) {
    throw new Error(
      `full-frame avg luminance ${full.avgLum.toFixed(3)} — shader error fills white`,
    );
  }

  const deltaLum = Math.abs(cockpit.avgLum - above.avgLum);
  if (deltaLum < 0.02) {
    throw new Error(
      `cockpit region (lum ${cockpit.avgLum.toFixed(3)}) looks identical to above-track ` +
        `(lum ${above.avgLum.toFixed(3)}) — cockpit probably didn't render`,
    );
  }

  const maxAbove = Math.max(above.avgR, above.avgG, above.avgB);
  const minAbove = Math.min(above.avgR, above.avgG, above.avgB);
  if (maxAbove > 10 && minAbove / maxAbove < 0.25) {
    throw new Error(
      `above-track region is colour-dominated: R=${above.avgR.toFixed(0)} ` +
        `G=${above.avgG.toFixed(0)} B=${above.avgB.toFixed(0)} — probably fish-eye ` +
        `FOV is blowing out arches/dome`,
    );
  }

  if (cockpit.pctBright > 0.9) {
    throw new Error(
      `cockpit region ${(cockpit.pctBright * 100).toFixed(0)}% near-white — unlit plane`,
    );
  }
  if (cockpit.pctDark > 0.9) {
    throw new Error(
      `cockpit region ${(cockpit.pctDark * 100).toFixed(0)}% near-black — cockpit vanished`,
    );
  }

  return { full, above, cockpit };
}

/** Format stats for failure messages / diag dumps. */
export function formatStats(stats: Record<string, RegionStats>): string {
  return Object.values(stats)
    .map(
      (s) =>
        `  ${s.name}: lum=${s.avgLum.toFixed(3)} R=${s.avgR.toFixed(0)} G=${s.avgG.toFixed(0)} ` +
        `B=${s.avgB.toFixed(0)} bright=${(s.pctBright * 100).toFixed(1)}% ` +
        `dark=${(s.pctDark * 100).toFixed(1)}%`,
    )
    .join('\n');
}
