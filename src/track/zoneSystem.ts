import type { ZoneId } from '@/utils/constants';

/**
 * Per-zone visual identity. Every value in here feeds the renderer; nothing
 * here is gameplay — collision, scoring, speed caps live elsewhere.
 *
 * Colors are from the STANDARDS.md brand palette:
 *   Red #E53935  Yellow #FFD600  Blue #1E88E5  Purple #8E24AA
 *   Orange #F36F21  Night #0B0F1A
 *
 * Each zone has a completely distinct combination so the player can feel
 * the transition without reading the banner.
 */
export interface ZoneTheme {
  id: ZoneId;
  name: string;

  /** Sky background top colour (fog/scene.background). */
  skyTop: string;
  /** Sky background bottom colour (used for gradient blending). */
  skyBottom: string;

  /** Three.js FogExp2 colour. */
  fogColor: string;
  /** Exp2 fog density: higher = thicker. Midway thin, Funhouse thick. */
  fogDensity: number;

  /** Ambient light colour — primary cast over all geometry. */
  ambientColor: string;
  /** Ambient light intensity scalar. */
  ambientIntensity: number;

  /** Directional key-light colour. */
  dirLightColor: string;
  /** Directional key-light intensity. */
  dirLightIntensity: number;
  /** Key-light position [x, y, z]. */
  dirLightPos: [number, number, number];

  /** Optional fill light for zone gimmick (fire under-glow, strobe, etc.). */
  fillLightColor: string;
  fillLightIntensity: number;

  /**
   * Ground plane colour. Ring of Fire deliberately darkens the track
   * underfoot; Funhouse goes near-black so neon pops.
   */
  groundColor: string;

  /** Accent colour used for balloon/prop instanced mesh tint. */
  accent: string;

  /**
   * Prop variant: controls which instanced props ZoneProps renders.
   *   'tents'    — striped carnival tent cones (Midway Strip)
   *   'balloons' — floating sphere balloons at varied heights (Balloon Alley)
   *   'hoops'    — torus rings on posts, emissive orange (Ring of Fire backdrop)
   *   'mirrors'  — reflective flat planes lining track edges (Funhouse Frenzy)
   */
  propVariant: 'tents' | 'balloons' | 'hoops' | 'mirrors';

  /**
   * Secondary prop accent colour (e.g. balloon string colour, hoop glow tint).
   */
  propAccent: string;
}

export const ZONE_THEMES: Record<ZoneId, ZoneTheme> = {
  /**
   * Zone 0 — Midway Strip
   * Warm daylight carnival. Orange sky, striped tent arches, yellow accent.
   * Thin fog, bright key light from above. Classic big-top dayshift feel.
   */
  'midway-strip': {
    id: 'midway-strip',
    name: 'The Midway Strip',
    skyTop: '#3d1a00',
    skyBottom: '#f36f21',
    fogColor: '#f36f21',
    fogDensity: 0.003,
    ambientColor: '#ffd600',
    ambientIntensity: 0.55,
    dirLightColor: '#fff4cc',
    dirLightIntensity: 1.4,
    dirLightPos: [6, 10, 4],
    fillLightColor: '#f36f21',
    fillLightIntensity: 0.4,
    groundColor: '#6b1410',
    accent: '#ffd600',
    propVariant: 'tents',
    propAccent: '#e53935',
  },

  /**
   * Zone 1 — Balloon Alley
   * Hot-pink/purple sky, balloons float beside the track.
   * Soft fill light from above, purple-tinted ambient.
   */
  'balloon-alley': {
    id: 'balloon-alley',
    name: 'Balloon Alley',
    skyTop: '#4a0d6e',
    skyBottom: '#ff2d87',
    fogColor: '#8e24aa',
    fogDensity: 0.0025,
    ambientColor: '#e53935',
    ambientIntensity: 0.45,
    dirLightColor: '#ff2d87',
    dirLightIntensity: 1.1,
    dirLightPos: [0, 12, 0],
    fillLightColor: '#8e24aa',
    fillLightIntensity: 0.6,
    groundColor: '#2a0d3d',
    accent: '#ff2d87',
    propVariant: 'balloons',
    propAccent: '#8e24aa',
  },

  /**
   * Zone 2 — Ring of Fire
   * Dark orange-red sky, ground is almost black.
   * Intense orange key light from below-front, red-tinted ambient.
   * Emissive fire hoops line the shoulders.
   */
  'ring-of-fire': {
    id: 'ring-of-fire',
    name: 'Ring of Fire',
    skyTop: '#0a0000',
    skyBottom: '#e53935',
    fogColor: '#3d0800',
    fogDensity: 0.007,
    ambientColor: '#e53935',
    ambientIntensity: 0.3,
    dirLightColor: '#f36f21',
    dirLightIntensity: 1.8,
    dirLightPos: [0, 2, -8],
    fillLightColor: '#ff3b00',
    fillLightIntensity: 1.2,
    groundColor: '#1a0000',
    accent: '#f36f21',
    propVariant: 'hoops',
    propAccent: '#ffd600',
  },

  /**
   * Zone 3 — Funhouse Frenzy
   * Near-black with purple/blue strobe. Mirror walls lining the track.
   * Heavy fog so you can't see far. Multiple coloured fill lights.
   */
  'funhouse-frenzy': {
    id: 'funhouse-frenzy',
    name: 'Funhouse Frenzy',
    skyTop: '#050014',
    skyBottom: '#8e24aa',
    fogColor: '#1a0536',
    fogDensity: 0.009,
    ambientColor: '#1e88e5',
    ambientIntensity: 0.25,
    dirLightColor: '#8e24aa',
    dirLightIntensity: 0.9,
    dirLightPos: [-4, 8, 2],
    fillLightColor: '#ff2d87',
    fillLightIntensity: 1.5,
    groundColor: '#0a0014',
    accent: '#1e88e5',
    propVariant: 'mirrors',
    propAccent: '#8e24aa',
  },
};

/** Hard-fail on unknown ZoneId — no silent fallback. */
export function themeFor(zone: ZoneId): ZoneTheme {
  const t = ZONE_THEMES[zone];
  if (!t) throw new Error(`themeFor: unknown ZoneId "${String(zone)}"`);
  return t;
}
