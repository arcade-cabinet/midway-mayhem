/**
 * Midway Mayhem typography scale.
 *
 * Two font stacks (display = Bangers, ui = Rajdhani) + mono for errors/stack.
 * Every text element reads its type from here.
 */
import type { CSSProperties } from 'react';

export const font = {
  display: '"Bangers", "Impact", system-ui, sans-serif',
  ui: '"Rajdhani", system-ui, sans-serif',
  mono: 'ui-monospace, "Menlo", "Monaco", monospace',
} as const;

export interface TypeStyle {
  family: string;
  size: string;
  weight: number;
  tracking: string;
  lineHeight?: number;
  upper?: boolean;
}

/** Display (Bangers) — for brand titles, banners, scores, loud buttons */
export const display: Record<'hero' | 'banner' | 'score' | 'button' | 'tag', TypeStyle> = {
  hero: {
    family: font.display,
    size: 'clamp(3rem, 14vw, 7.5rem)',
    weight: 400,
    tracking: '0.05em',
    lineHeight: 0.95,
  },
  banner: {
    family: font.display,
    size: 'clamp(2rem, 6vw, 4rem)',
    weight: 400,
    tracking: '0.06em',
    lineHeight: 1.0,
  },
  score: {
    family: font.display,
    size: '2rem',
    weight: 400,
    tracking: '0.04em',
    lineHeight: 1.0,
  },
  button: {
    family: font.display,
    size: '1.5rem',
    weight: 400,
    tracking: '0.08em',
    lineHeight: 1.0,
  },
  tag: {
    family: font.display,
    size: '1.1rem',
    weight: 400,
    tracking: '0.08em',
    lineHeight: 1.0,
  },
};

/** UI (Rajdhani) — for labels, body text, meta */
export const ui: Record<'label' | 'body' | 'small' | 'meta', TypeStyle> = {
  label: {
    family: font.ui,
    size: '0.7rem',
    weight: 700,
    tracking: '0.18em',
    upper: true,
  },
  body: {
    family: font.ui,
    size: '0.95rem',
    weight: 500,
    tracking: '0.02em',
  },
  small: {
    family: font.ui,
    size: '0.75rem',
    weight: 500,
    tracking: '0.05em',
  },
  meta: {
    family: font.ui,
    size: '0.7rem',
    weight: 400,
    tracking: '0.05em',
  },
};

/** Mono — for error modals, stack traces, diagnostic dumps */
export const mono: Record<'stack' | 'inline', TypeStyle> = {
  stack: {
    family: font.mono,
    size: '0.78rem',
    weight: 400,
    tracking: '0',
    lineHeight: 1.4,
  },
  inline: {
    family: font.mono,
    size: '0.85rem',
    weight: 500,
    tracking: '0',
  },
};

/** Convert a TypeStyle into a CSSProperties object for direct spread */
export function typeStyle(s: TypeStyle): CSSProperties {
  return {
    fontFamily: s.family,
    fontSize: s.size,
    fontWeight: s.weight,
    letterSpacing: s.tracking,
    ...(s.lineHeight !== undefined ? { lineHeight: s.lineHeight } : {}),
    ...(s.upper ? { textTransform: 'uppercase' as const } : {}),
  };
}
