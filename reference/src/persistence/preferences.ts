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
const OPFS_FILE = 'mm-prefs.json';

// In-memory cache — hydrated once from OPFS on first read.
const _cache = new Map<string, string>();
let _cacheHydrated = false;

/**
 * True on a real Capacitor native build (iOS/Android). False on web —
 * @capacitor/preferences on web throws "not implemented on web" unless the
 * full Capacitor web runtime is initialized, which we don't use.
 */
function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  // biome-ignore lint/suspicious/noExplicitAny: Capacitor injects this globally at native boot
  const cap = (window as any).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

async function hydrateFromOpfs(): Promise<void> {
  if (_cacheHydrated) return;
  _cacheHydrated = true;
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return;
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(OPFS_FILE, { create: false });
    const file = await handle.getFile();
    const text = await file.text();
    if (!text) return;
    const parsed = JSON.parse(text) as Record<string, string>;
    for (const [k, v] of Object.entries(parsed)) _cache.set(k, v);
  } catch {
    // First run (file doesn't exist) or OPFS unavailable — leave cache empty
  }
}

async function flushToOpfs(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return;
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(OPFS_FILE, { create: true });
    const writable = await handle.createWritable();
    const snap: Record<string, string> = {};
    for (const [k, v] of _cache.entries()) snap[k] = v;
    await writable.write(JSON.stringify(snap));
    await writable.close();
  } catch {
    // Swallow — losing prefs on page close is degraded but non-fatal
  }
}

async function getNativePreferences() {
  if (!isCapacitorNative()) return null;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    return Preferences;
  } catch {
    return null;
  }
}

export async function prefSetString(key: string, value: string): Promise<void> {
  const k = PREFIX + key;
  const prefs = await getNativePreferences();
  if (prefs) {
    await prefs.set({ key: k, value });
    return;
  }
  // Web path: OPFS-backed KV cache (never localStorage).
  await hydrateFromOpfs();
  _cache.set(k, value);
  await flushToOpfs();
}

export async function prefGetString(key: string): Promise<string | null> {
  const k = PREFIX + key;
  const prefs = await getNativePreferences();
  if (prefs) {
    const { value } = await prefs.get({ key: k });
    return value ?? null;
  }
  await hydrateFromOpfs();
  return _cache.get(k) ?? null;
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
  const prefs = await getNativePreferences();
  if (prefs) {
    await prefs.remove({ key: k });
    return;
  }
  await hydrateFromOpfs();
  _cache.delete(k);
  await flushToOpfs();
}

/** Clear the in-memory cache (and OPFS mirror on web). Used by tests + reset flows. */
export function clearPrefsForTests(): void {
  _cache.clear();
  _cacheHydrated = false;
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
