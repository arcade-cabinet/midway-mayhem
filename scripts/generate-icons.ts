#!/usr/bin/env -S npx tsx
/**
 * generate-icons.ts
 *
 * Rasterizes raw-assets/app-icon.svg into every iOS + Android icon size
 * required by Capacitor. Hard-fails on any error — no fallbacks.
 *
 * Usage:
 *   pnpm icons
 *   npx tsx scripts/generate-icons.ts
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const SVG_SOURCE = resolve(ROOT, 'raw-assets', 'app-icon.svg');

// ---------------------------------------------------------------------------
// iOS — AppIcon.appiconset
// All sizes required by Xcode universal iOS app icon set.
// ---------------------------------------------------------------------------

const IOS_APPICONSET = resolve(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');

interface IosIconSpec {
  size: number;
  filename: string;
  /** idiom as used by Xcode Contents.json */
  idiom: string;
  /** display size string, e.g. "20x20" */
  displaySize: string;
  /** scale string, e.g. "1x" | "2x" | "3x" */
  scale: string;
}

const IOS_SPECS: IosIconSpec[] = [
  // iPhone notification (20pt)
  { size: 40, filename: 'Icon-20@2x.png', idiom: 'iphone', displaySize: '20x20', scale: '2x' },
  { size: 60, filename: 'Icon-20@3x.png', idiom: 'iphone', displaySize: '20x20', scale: '3x' },
  // iPhone settings (29pt)
  { size: 29, filename: 'Icon-29@1x.png', idiom: 'iphone', displaySize: '29x29', scale: '1x' },
  { size: 58, filename: 'Icon-29@2x.png', idiom: 'iphone', displaySize: '29x29', scale: '2x' },
  { size: 87, filename: 'Icon-29@3x.png', idiom: 'iphone', displaySize: '29x29', scale: '3x' },
  // iPhone spotlight (40pt)
  { size: 80, filename: 'Icon-40@2x.png', idiom: 'iphone', displaySize: '40x40', scale: '2x' },
  { size: 120, filename: 'Icon-40@3x.png', idiom: 'iphone', displaySize: '40x40', scale: '3x' },
  // iPhone app icon (60pt)
  { size: 120, filename: 'Icon-60@2x.png', idiom: 'iphone', displaySize: '60x60', scale: '2x' },
  { size: 180, filename: 'Icon-60@3x.png', idiom: 'iphone', displaySize: '60x60', scale: '3x' },
  // iPad notification (20pt)
  { size: 20, filename: 'Icon-ipad-20@1x.png', idiom: 'ipad', displaySize: '20x20', scale: '1x' },
  { size: 40, filename: 'Icon-ipad-20@2x.png', idiom: 'ipad', displaySize: '20x20', scale: '2x' },
  // iPad settings (29pt)
  { size: 29, filename: 'Icon-ipad-29@1x.png', idiom: 'ipad', displaySize: '29x29', scale: '1x' },
  { size: 58, filename: 'Icon-ipad-29@2x.png', idiom: 'ipad', displaySize: '29x29', scale: '2x' },
  // iPad spotlight (40pt)
  { size: 40, filename: 'Icon-ipad-40@1x.png', idiom: 'ipad', displaySize: '40x40', scale: '1x' },
  { size: 80, filename: 'Icon-ipad-40@2x.png', idiom: 'ipad', displaySize: '40x40', scale: '2x' },
  // iPad app icon (76pt)
  { size: 76, filename: 'Icon-76@1x.png', idiom: 'ipad', displaySize: '76x76', scale: '1x' },
  { size: 152, filename: 'Icon-76@2x.png', idiom: 'ipad', displaySize: '76x76', scale: '2x' },
  // iPad Pro (83.5pt)
  { size: 167, filename: 'Icon-83.5@2x.png', idiom: 'ipad', displaySize: '83.5x83.5', scale: '2x' },
  // App Store
  {
    size: 1024,
    filename: 'Icon-1024.png',
    idiom: 'ios-marketing',
    displaySize: '1024x1024',
    scale: '1x',
  },
];

// ---------------------------------------------------------------------------
// Android — mipmap-* directories
// ---------------------------------------------------------------------------

interface AndroidIconSpec {
  size: number;
  dir: string;
}

const ANDROID_RES = resolve(ROOT, 'android/app/src/main/res');

const ANDROID_SPECS: AndroidIconSpec[] = [
  { size: 48, dir: 'mipmap-mdpi' },
  { size: 72, dir: 'mipmap-hdpi' },
  { size: 96, dir: 'mipmap-xhdpi' },
  { size: 144, dir: 'mipmap-xxhdpi' },
  { size: 192, dir: 'mipmap-xxxhdpi' },
];

// ---------------------------------------------------------------------------
// iOS Contents.json builder
// ---------------------------------------------------------------------------

interface ContentsJsonImage {
  filename?: string;
  idiom: string;
  platform?: string;
  scale?: string;
  size?: string;
}

interface ContentsJson {
  images: ContentsJsonImage[];
  info: { author: string; version: number };
}

function buildContentsJson(specs: IosIconSpec[]): string {
  // Deduplicate filenames for the images array (120px appears for both
  // iphone-40@3x and iphone-60@2x — keep both entries since they differ
  // by idiom/size).
  const images: ContentsJsonImage[] = specs.map((s) => ({
    filename: s.filename,
    idiom: s.idiom,
    ...(s.idiom === 'ios-marketing' ? { platform: 'ios' } : {}),
    scale: s.scale,
    size: s.displaySize,
  }));

  const contents: ContentsJson = {
    images,
    info: { author: 'xcode', version: 1 },
  };

  return JSON.stringify(contents, null, 2);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Reading SVG source:', SVG_SOURCE);
  const svgBuffer = await readFile(SVG_SOURCE);

  // Ensure destination dirs exist
  await mkdir(IOS_APPICONSET, { recursive: true });
  for (const spec of ANDROID_SPECS) {
    await mkdir(resolve(ANDROID_RES, spec.dir), { recursive: true });
  }

  // Rasterize iOS icons
  console.log('\nGenerating iOS icons...');
  // Track which filenames we have already generated to avoid redundant writes
  const iosGenerated = new Map<string, number>();

  for (const spec of IOS_SPECS) {
    const destPath = resolve(IOS_APPICONSET, spec.filename);
    const existing = iosGenerated.get(spec.filename);
    if (existing !== undefined) {
      if (existing !== spec.size) {
        throw new Error(
          `Filename collision with different sizes: ${spec.filename} ` +
            `(${existing}px vs ${spec.size}px)`,
        );
      }
      console.log(`  skip (dup)  ${spec.filename}  ${spec.size}px`);
      continue;
    }
    await sharp(svgBuffer, { density: 300 }).resize(spec.size, spec.size).png().toFile(destPath);
    iosGenerated.set(spec.filename, spec.size);
    console.log(`  ✓  ${spec.filename}  (${spec.size}px)`);
  }

  // Write Contents.json
  const contentsPath = resolve(IOS_APPICONSET, 'Contents.json');
  await writeFile(contentsPath, buildContentsJson(IOS_SPECS), 'utf8');
  console.log(`\n  ✓  Contents.json written`);

  // Rasterize Android icons
  console.log('\nGenerating Android icons...');
  for (const spec of ANDROID_SPECS) {
    const destPath = resolve(ANDROID_RES, spec.dir, 'ic_launcher.png');
    await sharp(svgBuffer, { density: 300 }).resize(spec.size, spec.size).png().toFile(destPath);
    console.log(`  ✓  ${spec.dir}/ic_launcher.png  (${spec.size}px)`);

    // Also write ic_launcher_round.png (same image — square with rounded
    // appearance achieved by Android's adaptive icon system)
    const roundPath = resolve(ANDROID_RES, spec.dir, 'ic_launcher_round.png');
    await sharp(svgBuffer, { density: 300 }).resize(spec.size, spec.size).png().toFile(roundPath);
    console.log(`  ✓  ${spec.dir}/ic_launcher_round.png  (${spec.size}px)`);
  }

  console.log('\nAll icons generated successfully.');
}

main().catch((err: unknown) => {
  console.error('generate-icons FAILED:', err);
  process.exit(1);
});
