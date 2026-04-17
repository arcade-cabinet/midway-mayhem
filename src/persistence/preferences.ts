/**
 * @module persistence/preferences
 *
 * Thin wrapper over @capacitor/preferences for small KV state:
 *   - Audio / haptics toggles
 *   - Cold-start loadout cache (mirror of SQLite loadout for sync cockpit init)
 *   - Last-launched version
 *   - Tutorial-seen flags
 *
 * All keys are namespaced under "mm." to avoid collisions.
 * In test/Node environments the module falls back to an in-memory map.
 */

const PREFIX = 'mm.';

// In-memory fallback for test/Node environments
const _memStore = new Map<string, string>();

function isTestEnv(): boolean {
  return (
    typeof process !== 'undefined' &&
    (process.env['VITEST'] === 'true' || process.env['NODE_ENV'] === 'test')
  );
}

async function getPreferences() {
  if (isTestEnv() || typeof window === 'undefined') return null;
  // Dynamic import so native plugin isn't required in Node/test
  try {
    const { Preferences } = await import('@capacitor/preferences');
    return Preferences;
  } catch {
    return null;
  }
}

export async function prefSetString(key: string, value: string): Promise<void> {
  const k = PREFIX + key;
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.set({ key: k, value });
  } else {
    _memStore.set(k, value);
  }
}

export async function prefGetString(key: string): Promise<string | null> {
  const k = PREFIX + key;
  const prefs = await getPreferences();
  if (prefs) {
    const { value } = await prefs.get({ key: k });
    return value ?? null;
  }
  return _memStore.get(k) ?? null;
}

export async function prefSetJSON<T>(key: string, value: T): Promise<void> {
  await prefSetString(key, JSON.stringify(value));
}

export async function prefGetJSON<T>(key: string): Promise<T | null> {
  const raw = await prefGetString(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function prefSetBool(key: string, value: boolean): Promise<void> {
  await prefSetString(key, value ? '1' : '0');
}

export async function prefGetBool(key: string, defaultValue = false): Promise<boolean> {
  const raw = await prefGetString(key);
  if (raw === null) return defaultValue;
  return raw === '1';
}

export async function prefRemove(key: string): Promise<void> {
  const k = PREFIX + key;
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.remove({ key: k });
  } else {
    _memStore.delete(k);
  }
}

/** Clear in-memory store for tests. */
export function clearPrefsForTests(): void {
  _memStore.clear();
}

// ─── Named preference keys ─────────────────────────────────────────────────

export const PREF_KEYS = {
  /** Cold-start loadout cache (JSON blob matching LoadoutRow). */
  LOADOUT_CACHE: 'loadout.cache',
  /** Tutorial-seen flag. */
  TUTORIAL_SEEN: 'tutorial.seen',
  /** Audio enabled. */
  AUDIO_ENABLED: 'audio.enabled',
  /** Haptics enabled. */
  HAPTICS_ENABLED: 'haptics.enabled',
  /** Last launched app version. */
  LAST_VERSION: 'meta.lastVersion',
} as const;
