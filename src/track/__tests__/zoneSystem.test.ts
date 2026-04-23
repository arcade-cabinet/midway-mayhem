/**
 * zoneSystem unit tests — theme lookup keyed by ZoneId.
 * Validates structural completeness, color hex format, and positive fog.
 */
import { describe, expect, it } from 'vitest';
import { themeFor, ZONE_THEMES } from '@/track/zoneSystem';
import { ZONES } from '@/utils/constants';

describe('ZONE_THEMES', () => {
  it('has a theme for every zone in ZONES', () => {
    for (const z of ZONES) {
      expect(ZONE_THEMES[z.id]).toBeDefined();
    }
  });

  it('each theme.id matches its map key', () => {
    for (const z of ZONES) {
      expect(ZONE_THEMES[z.id].id).toBe(z.id);
    }
  });

  it('each theme has a non-empty display name', () => {
    for (const z of ZONES) {
      expect(ZONE_THEMES[z.id].name.length).toBeGreaterThan(0);
    }
  });

  it('every colour field is a 7-char hex string', () => {
    const hex = /^#[0-9a-fA-F]{6}$/;
    for (const z of ZONES) {
      const t = ZONE_THEMES[z.id];
      for (const field of [
        'skyTop',
        'skyBottom',
        'fogColor',
        'ambientColor',
        'dirLightColor',
        'fillLightColor',
        'groundColor',
        'accent',
        'propAccent',
      ] as const) {
        expect(t[field]).toMatch(hex);
      }
    }
  });

  it('fogDensity is a positive finite number', () => {
    for (const z of ZONES) {
      const t = ZONE_THEMES[z.id];
      expect(t.fogDensity).toBeGreaterThan(0);
      expect(Number.isFinite(t.fogDensity)).toBe(true);
    }
  });
});

describe('themeFor', () => {
  it('returns the same object as ZONE_THEMES[id]', () => {
    for (const z of ZONES) {
      expect(themeFor(z.id)).toBe(ZONE_THEMES[z.id]);
    }
  });

  it('is deterministic — repeated calls yield the same reference', () => {
    const first = themeFor('midway-strip');
    const second = themeFor('midway-strip');
    expect(first).toBe(second);
  });
});
