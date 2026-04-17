/**
 * @module persistence/tutorial
 *
 * First-time-only prompt/toast flags backed by @capacitor/preferences.
 * Sync-first-try via an in-memory cache so React render paths avoid await.
 *
 * Design choice: tutorial flags are sync after first load (in-memory cache),
 * while achievement grants are async (SQLite round-trip). This lets HUD
 * conditionally render tutorial overlays without suspending the render tree,
 * while achievements can afford the extra latency because toast is cosmetic.
 */

import { Preferences } from '@capacitor/preferences';

export type TutorialSlug =
  | 'first-honk'
  | 'first-ramp'
  | 'first-scare'
  | 'first-trick'
  | 'first-pickup-mega'
  | 'first-zone-transition'
  | 'plunge-explained';

const PREFS_PREFIX = 'mm_tutorial_';

// In-memory cache: loaded lazily and kept fresh on writes.
const _seenAt = new Map<TutorialSlug, number>();
let _hydrated = false;

// ─── Hydration ───────────────────────────────────────────────────────────────

/**
 * Load all tutorial flags into the in-memory cache.
 * Called once during App init. Safe to call multiple times.
 */
export async function hydrateTutorialFlags(): Promise<void> {
  if (_hydrated) return;

  const slugs: TutorialSlug[] = [
    'first-honk',
    'first-ramp',
    'first-scare',
    'first-trick',
    'first-pickup-mega',
    'first-zone-transition',
    'plunge-explained',
  ];

  await Promise.all(
    slugs.map(async (slug) => {
      const { value } = await Preferences.get({ key: `${PREFS_PREFIX}${slug}` });
      if (value) _seenAt.set(slug, Number(value));
    }),
  );

  _hydrated = true;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Synchronous check (uses in-memory cache).
 * Call hydrateTutorialFlags() during boot before using this.
 * Returns true if the tutorial for this slug has never been shown.
 */
export function shouldShow(slug: TutorialSlug): boolean {
  return !_seenAt.has(slug);
}

/**
 * Stamp the slug as seen (now). Async write to Preferences; sync cache update.
 */
export async function markShown(slug: TutorialSlug): Promise<void> {
  const now = Date.now();
  _seenAt.set(slug, now);
  await Preferences.set({
    key: `${PREFS_PREFIX}${slug}`,
    value: String(now),
  });
}

/**
 * Returns the timestamp when the slug was first seen, or null if never.
 */
export function getFirstSeenAt(slug: TutorialSlug): number | null {
  return _seenAt.get(slug) ?? null;
}

/** Reset for tests. */
export function resetTutorialForTests(): void {
  _seenAt.clear();
  _hydrated = false;
}
