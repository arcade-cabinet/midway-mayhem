/**
 * Midway Mayhem design tokens.
 *
 * Single source of truth for color, spacing, radius, elevation, motion,
 * layering, and breakpoints. Every HUD/UI/dialog component reads from
 * here — nothing inline, nothing guessed.
 *
 * Brand palette is derived from COLORS in src/utils/constants.ts (source
 * of truth). Changing palette values must update constants.ts,
 * src/app/global.css (--mm-* variables), and scripts/bake-kit.py (PALETTE).
 */

import { COLORS } from '@/utils/constants';

export const color = {
  // Brand palette — derived from COLORS (constants.ts is the source of truth)
  red: COLORS.RED,
  yellow: COLORS.YELLOW,
  blue: COLORS.BLUE,
  purple: COLORS.PURPLE,
  orange: COLORS.ORANGE,
  green: COLORS.GREEN,
  night: COLORS.NIGHT,

  // Supporting
  walnut: '#120718',
  white: '#FCFCFA',
  dim: 'rgba(255,255,255,0.6)',

  // Surfaces
  surfaceDark: 'rgba(11,15,26,0.65)',
  surfaceLight: 'rgba(11,15,26,0.35)',
  surfaceElevated: 'rgba(18,7,24,0.85)',

  // Borders / accents
  borderAccent: 'rgba(255,214,0,0.45)',
  borderSubtle: 'rgba(255,255,255,0.12)',
  borderDanger: '#E53935',
  borderInfo: '#1E88E5',
  borderSuccess: '#FFD600',

  // Overlays
  overlayDim: 'rgba(10,0,15,0.88)',

  // Status tones
  toneDanger: '#E53935',
  toneWarn: '#F36F21',
  toneSuccess: '#FFD600',
  toneInfo: '#1E88E5',
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const space = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  xxxxl: 64,
} as const;

export const elevation = {
  panel: '0 4px 16px rgba(0,0,0,0.45)',
  float: '0 8px 24px rgba(0,0,0,0.55)',
  glow: '0 0 24px rgba(255,214,0,0.35)',
  danger: '0 0 32px rgba(229,57,53,0.45)',
  success: '0 0 24px rgba(30,136,229,0.35)',
} as const;

export const motion = {
  // Durations in ms
  instant: 80,
  fast: 150,
  base: 220,
  slow: 400,
  zoneBanner: 2200,

  easing: {
    out: 'cubic-bezier(0.22, 1, 0.36, 1)',
    soft: 'cubic-bezier(0.4, 0, 0.2, 1)',
    punch: 'cubic-bezier(0.5, -0.5, 0.25, 1.5)',
    linear: 'linear',
  },
} as const;

export const zLayer = {
  canvas: 0,
  hud: 20,
  banner: 30,
  dialog: 100,
  errorModal: 10000,
} as const;

/** Form-factor breakpoints — aspect-ratio driven, not width-driven, because
 * portrait-vs-landscape matters more than pixel width for gameplay. */
export const breakpoints = {
  /** Aspect ratio thresholds */
  aspect: {
    phonePortrait: 0.65, // ≤ 0.65 = portrait phone
    tabletPortrait: 0.85, // ≤ 0.85 = portrait tablet/foldable
    landscapeThreshold: 1.0, // > 1.0 = landscape
    wide: 1.8, // ≥ 1.8 = widescreen
    ultrawide: 2.3, // ≥ 2.3 = ultrawide
  },
  /** Viewport width thresholds (in px, for HUD sizing not form detection) */
  viewport: {
    sm: 480,
    md: 768,
    lg: 1024,
    xl: 1440,
    xxl: 1920,
  },
} as const;

/** Safe-area-inset helpers (string, for CSS values) */
export const safeArea = {
  top: 'env(safe-area-inset-top, 0px)',
  right: 'env(safe-area-inset-right, 0px)',
  bottom: 'env(safe-area-inset-bottom, 0px)',
  left: 'env(safe-area-inset-left, 0px)',
} as const;

/**
 * Precomputed layout constants derived from tokens.
 * Kept here so .tsx files can consume values without embedding arithmetic.
 */
export const layout = {
  /** Bottom offset for corner-anchored panels: two xxxl gaps + nav bar height. */
  panelBottomOffset: space.xxxl * 2 + 48,
} as const;

/** A union of all design token value types (strings, numbers, objects). */
export type DesignTokenGroup =
  | typeof color
  | typeof radius
  | typeof space
  | typeof elevation
  | typeof motion
  | typeof zLayer
  | typeof breakpoints
  | typeof safeArea;
