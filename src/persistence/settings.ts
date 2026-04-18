/**
 * @module persistence/settings
 *
 * Cross-run player preferences backed by the shared preferences abstraction
 * (prefGetJSON / prefSetJSON from src/persistence/preferences.ts), which
 * handles native Capacitor vs. web OPFS routing automatically.
 *
 * Dispatch: updateSettings fires a settingsChanged CustomEvent on window so
 * systems like hapticsBus can react immediately.
 */

import { reportError } from '@/game/errorBus';
import { hapticsBus } from '@/game/hapticsBus';
import { prefGetJSON, prefSetJSON } from './preferences';

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
  /** Show the racing-line ghost overlay during gameplay. Default true. */
  showRacingLine: boolean;
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
  showRacingLine: true,
};

// Preferences key (without the "mm." prefix — prefGetJSON adds that)
const PREFS_KEY = 'settings';

// ─── Validation ──────────────────────────────────────────────────────────────

const VALID_CONTROLS: ReadonlySet<string> = new Set(['pointer', 'keyboard', 'touch', 'gamepad']);

/**
 * Validate and normalize a raw parsed object into a safe GameSettings.
 * Only well-typed fields are accepted; anything invalid falls back to DEFAULTS.
 */
function validate(raw: unknown): GameSettings {
  if (raw === null || typeof raw !== 'object') return { ...DEFAULTS };
  const r = raw as Record<string, unknown>;

  const audioEnabled = typeof r.audioEnabled === 'boolean' ? r.audioEnabled : DEFAULTS.audioEnabled;
  const hapticsEnabled =
    typeof r.hapticsEnabled === 'boolean' ? r.hapticsEnabled : DEFAULTS.hapticsEnabled;
  const reducedMotion =
    typeof r.reducedMotion === 'boolean' ? r.reducedMotion : DEFAULTS.reducedMotion;
  const uiScaleMultiplier =
    typeof r.uiScaleMultiplier === 'number' && Number.isFinite(r.uiScaleMultiplier)
      ? r.uiScaleMultiplier
      : DEFAULTS.uiScaleMultiplier;
  const preferredControl =
    typeof r.preferredControl === 'string' && VALID_CONTROLS.has(r.preferredControl)
      ? (r.preferredControl as PreferredControl)
      : DEFAULTS.preferredControl;
  const showFps = typeof r.showFps === 'boolean' ? r.showFps : DEFAULTS.showFps;
  const showZoneBanner =
    typeof r.showZoneBanner === 'boolean' ? r.showZoneBanner : DEFAULTS.showZoneBanner;
  const subtitles = typeof r.subtitles === 'boolean' ? r.subtitles : DEFAULTS.subtitles;
  const showRacingLine =
    typeof r.showRacingLine === 'boolean' ? r.showRacingLine : DEFAULTS.showRacingLine;

  return {
    audioEnabled,
    hapticsEnabled,
    reducedMotion,
    uiScaleMultiplier,
    preferredControl,
    showFps,
    showZoneBanner,
    subtitles,
    showRacingLine,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Read settings from preferences. Returns defaults if never set.
 * Hard-fails (via reportError) if the stored value is corrupt, then returns
 * defaults so the game is still playable after the error modal.
 */
export async function getSettings(): Promise<GameSettings> {
  let raw: unknown;
  try {
    raw = await prefGetJSON<unknown>(PREFS_KEY);
  } catch (err) {
    reportError(err, 'settings.getSettings');
    return { ...DEFAULTS };
  }
  if (raw === null) return { ...DEFAULTS };
  try {
    return validate(raw);
  } catch (err) {
    reportError(err, 'settings.getSettings — corrupt settings');
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

  await prefSetJSON(PREFS_KEY, next);

  // Wire hapticsBus immediately
  hapticsBus.setEnabled(next.hapticsEnabled);

  // Broadcast to any other listener (e.g. audioBus can listen)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mm:settingsChanged', { detail: next }));
  }
}

/** Exported constant so consumers can subscribe in a type-safe way. */
export const SETTINGS_CHANGED_EVENT = 'mm:settingsChanged' as const;
