/**
 * Declarative asset manifest. Every required binary asset is listed here.
 * Hard-fail: if an entry is missing at runtime, preloader reports via
 * errorBus and the error modal displays the specific failing path.
 */

export interface AssetEntry {
  id: string;
  kind: 'hdri' | 'texture' | 'gltf' | 'audio';
  /** Path relative to the `public/` root (no leading slash). */
  path: string;
  required: true;
}

export const ASSET_MANIFEST: readonly AssetEntry[] = [
  // Big-top dome HDRI — fully 360° immersive environment
  { id: 'hdri:circus_arena', kind: 'hdri', path: 'hdri/circus_arena_2k.hdr', required: true },

  // Kenney Racing Kit — road pieces (the TRACK)
  { id: 'gltf:roadStart', kind: 'gltf', path: 'models/roadStart.glb', required: true },
  { id: 'gltf:roadStraight', kind: 'gltf', path: 'models/roadStraight.glb', required: true },
  { id: 'gltf:roadStraightLong', kind: 'gltf', path: 'models/roadStraightLong.glb', required: true },
  { id: 'gltf:roadStraightArrow', kind: 'gltf', path: 'models/roadStraightArrow.glb', required: true },
  { id: 'gltf:roadEnd', kind: 'gltf', path: 'models/roadEnd.glb', required: true },
  { id: 'gltf:roadCornerLarge', kind: 'gltf', path: 'models/roadCornerLarge.glb', required: true },
  { id: 'gltf:roadCornerLarger', kind: 'gltf', path: 'models/roadCornerLarger.glb', required: true },
  { id: 'gltf:roadCornerSmall', kind: 'gltf', path: 'models/roadCornerSmall.glb', required: true },
  { id: 'gltf:roadRamp', kind: 'gltf', path: 'models/roadRamp.glb', required: true },
  { id: 'gltf:roadRampLong', kind: 'gltf', path: 'models/roadRampLong.glb', required: true },
  { id: 'gltf:roadRampLongCurved', kind: 'gltf', path: 'models/roadRampLongCurved.glb', required: true },
  { id: 'gltf:roadCurved', kind: 'gltf', path: 'models/roadCurved.glb', required: true },

  // Racing Kit — roadside props
  { id: 'gltf:barrierRed', kind: 'gltf', path: 'models/barrierRed.glb', required: true },
  { id: 'gltf:barrierWhite', kind: 'gltf', path: 'models/barrierWhite.glb', required: true },
  { id: 'gltf:barrierWall', kind: 'gltf', path: 'models/barrierWall.glb', required: true },
  { id: 'gltf:tent', kind: 'gltf', path: 'models/tent.glb', required: true },
  { id: 'gltf:tentClosed', kind: 'gltf', path: 'models/tentClosed.glb', required: true },
  { id: 'gltf:bannerTowerRed', kind: 'gltf', path: 'models/bannerTowerRed.glb', required: true },
  { id: 'gltf:bannerTowerGreen', kind: 'gltf', path: 'models/bannerTowerGreen.glb', required: true },
  { id: 'gltf:flagCheckers', kind: 'gltf', path: 'models/flagCheckers.glb', required: true },
  { id: 'gltf:lightPostLarge', kind: 'gltf', path: 'models/lightPostLarge.glb', required: true },
  { id: 'gltf:lightRed', kind: 'gltf', path: 'models/lightRed.glb', required: true },
  { id: 'gltf:grandStand', kind: 'gltf', path: 'models/grandStand.glb', required: true },
  { id: 'gltf:grandStandCovered', kind: 'gltf', path: 'models/grandStandCovered.glb', required: true },
  { id: 'gltf:billboard', kind: 'gltf', path: 'models/billboard.glb', required: true },
  { id: 'gltf:pylon', kind: 'gltf', path: 'models/pylon.glb', required: true },
  { id: 'gltf:overheadRoundColored', kind: 'gltf', path: 'models/overheadRoundColored.glb', required: true },
  { id: 'gltf:cone', kind: 'gltf', path: 'models/cone.glb', required: true },
] as const;

function base(): string {
  const b = import.meta.env.BASE_URL || '/';
  return b.endsWith('/') ? b : `${b}/`;
}

export function assetUrl(id: string): string {
  const entry = ASSET_MANIFEST.find((a) => a.id === id);
  if (!entry) throw new Error(`[assets] Unknown asset id: ${id}`);
  return `${base()}${entry.path}`;
}

export function assetUrlFor(entry: AssetEntry): string {
  return `${base()}${entry.path}`;
}
