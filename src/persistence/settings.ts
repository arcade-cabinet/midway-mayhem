/**
 * @module persistence/settings
 *
 * Cross-run player preferences backed by @capacitor/preferences.
 * KV store — not SQLite — because settings are small atomics read at cold-start
 * before drizzle initializes.
 *
 * Dispatch: updateSettings fires a settingsChanged CustomEvent on window so
 * systems like hapticsBus can react immediately.
 */

import { Preferences } from '@capacitor/preferences';
import { hapticsBus } from '@/game/hapticsBus';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PreferredControl = 'pointer' | 'keyboard' | 'touch' | 'gamepad';

export interface GameSettings {
  audioEnabled: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  uiScaleMultiplier: number;
  preferredControl: PreferredControl;
  showFps: boolean;
  showZoneBanner: boolean;
  subtitles: boolean;
}

const DEFAULTS: GameSettings = {
  audioEnabled: true,
  hapticsEnabled: true,
  reducedMotion: false,
  uiScaleMultiplier: 1.0,
  preferredControl: 'pointer',
  showFps: false,
  showZoneBanner: true,
  subtitles: false,
};

// Preferences key
const PREFS_KEY = 'mm_settings';

// ─── Serialization ───────────────────────────────────────────────────────────

function serialize(s: GameSettings): string {
  return JSON.stringify(s);
}

function deserialize(raw: string): GameSettings {
  const parsed = JSON.parse(raw) as Partial<GameSettings>;
  // Merge with defaults so new fields added in future versions get defaults
  return { ...DEFAULTS, ...parsed };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Read settings from Preferences. Returns defaults if never set.
 */
export async function getSettings(): Promise<GameSettings> {
  const { value } = await Preferences.get({ key: PREFS_KEY });
  if (!value) return { ...DEFAULTS };
  try {
    return deserialize(value);
  } catch {
    // Corrupt entry — return defaults (not a hard-fail; settings are user-recoverable)
    return { ...DEFAULTS };
  }
}

/**
 * Merge a partial update into settings, persist, and notify systems.
 * Dispatches a 'mm:settingsChanged' CustomEvent on window (browser-only).
 * Also syncs hapticsBus.setEnabled immediately.
 */
export async function updateSettings(partial: Partial<GameSettings>): Promise<void> {
  const current = await getSettings();
  const next: GameSettings = { ...current, ...partial };

  await Preferences.set({ key: PREFS_KEY, value: serialize(next) });

  // Wire hapticsBus immediately
  hapticsBus.setEnabled(next.hapticsEnabled);

  // Broadcast to any other listener (e.g. audioBus can listen)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('mm:settingsChanged', { detail: next }),
    );
  }
}

/** Exported constant so consumers can subscribe in a type-safe way. */
export const SETTINGS_CHANGED_EVENT = 'mm:settingsChanged' as const;
