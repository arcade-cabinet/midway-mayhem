import type { ZoneId } from '@/utils/constants';

export interface ZoneTheme {
  id: ZoneId;
  name: string;
  skyTop: string;
  skyBottom: string;
  fogColor: string;
  fogDensity: number;
  ambientHue: string;
  accent: string;
}

export const ZONE_THEMES: Record<ZoneId, ZoneTheme> = {
  'midway-strip': {
    id: 'midway-strip',
    name: 'The Midway Strip',
    skyTop: '#2a0d3d',
    skyBottom: '#f36f21',
    fogColor: '#2a0d3d',
    fogDensity: 0.0035,
    ambientHue: '#5a2a8a',
    accent: '#ffd600',
  },
  'balloon-alley': {
    id: 'balloon-alley',
    name: 'Balloon Alley',
    skyTop: '#8ed9ff',
    skyBottom: '#fff1a8',
    fogColor: '#bfe7ff',
    fogDensity: 0.0025,
    ambientHue: '#1e88e5',
    accent: '#e53935',
  },
  'ring-of-fire': {
    id: 'ring-of-fire',
    name: 'Ring of Fire',
    skyTop: '#2a0505',
    skyBottom: '#ff3b1a',
    fogColor: '#5a0e0a',
    fogDensity: 0.006,
    ambientHue: '#e53935',
    accent: '#ffd600',
  },
  'funhouse-frenzy': {
    id: 'funhouse-frenzy',
    name: 'Funhouse Frenzy',
    skyTop: '#050014',
    skyBottom: '#8e24aa',
    fogColor: '#1a0536',
    fogDensity: 0.004,
    ambientHue: '#8e24aa',
    accent: '#1e88e5',
  },
};

export function themeFor(zone: ZoneId): ZoneTheme {
  return ZONE_THEMES[zone];
}
