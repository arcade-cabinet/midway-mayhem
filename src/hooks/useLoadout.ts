/**
 * @module hooks/useLoadout
 *
 * Loadout hook — reads the current cockpit loadout from SQLite and provides
 * an equip function that persists changes.
 *
 * v2 note: The reference used a zustand store, but zustand is not in the v2
 * dependency tree. This version uses a module-level in-memory cache + a React
 * hook for reactive reads, so components still re-render on change.
 *
 * The authority is always SQLite via persistence/profile. The in-memory cache
 * (loadoutCache) is invalidated on every equip call so the next read is fresh.
 */
import { useCallback, useEffect, useState } from 'react';
import { setHornSlug } from '@/audio/honkBus';
import { reportError } from '@/game/errorBus';
import { PREF_KEYS, prefGetJSON, prefSetJSON } from '@/persistence/preferences';
import { getLoadout, type LoadoutRow, setLoadout } from '@/persistence/profile';
import type { UnlockKind } from '@/persistence/schema';

// Module-level cache shared across hook instances
let loadoutCache: LoadoutRow | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

/** Read the loadout (from cache if warm, else SQLite). */
async function readLoadout(): Promise<LoadoutRow> {
  if (loadoutCache) return loadoutCache;
  const row = await getLoadout();
  loadoutCache = row;
  return row;
}

/**
 * Synchronous accessor returning the last-cached loadout or null if the
 * cache is cold. Only use this when you need an immediate snapshot (e.g.
 * debug capture) — the hook version remains the right choice for live UI
 * because it tracks cache invalidations across equip calls.
 */
export function getCachedLoadoutSync(): LoadoutRow | null {
  return loadoutCache;
}

/** Equip a slug for the given kind — persists to SQLite + updates cache. */
async function equipItem(kind: UnlockKind, slug: string): Promise<void> {
  const partial: Partial<LoadoutRow> = {};
  switch (kind) {
    case 'palette':
      partial.palette = slug;
      break;
    case 'ornament':
      partial.ornament = slug;
      break;
    case 'horn':
      partial.horn = slug;
      break;
    case 'horn_shape':
      partial.hornShape = slug;
      break;
    case 'rim':
      partial.rim = slug;
      break;
    case 'dice':
      partial.dice = slug;
      break;
    default:
      return;
  }
  await setLoadout(partial);
  const updated = await getLoadout();
  loadoutCache = updated;
  if (kind === 'horn') setHornSlug(slug);
  // Mirror to Preferences for next cold start
  await prefSetJSON(PREF_KEYS.LOADOUT_CACHE, updated).catch((err: unknown) =>
    reportError(err, 'useLoadout.mirrorToPrefs'),
  );
  notify();
}

export interface UseLoadoutReturn {
  loadout: LoadoutRow | null;
  equip: (kind: UnlockKind, slug: string) => Promise<void>;
}

/** Hook that provides loadout + equip. Re-renders when equip is called. */
export function useLoadoutStore(): UseLoadoutReturn {
  const [loadout, setLoadoutState] = useState<LoadoutRow | null>(loadoutCache);

  useEffect(() => {
    let cancelled = false;

    // 1. Prefs cache for a fast synchronous-ish first render
    prefGetJSON<LoadoutRow>(PREF_KEYS.LOADOUT_CACHE)
      .then((cached) => {
        if (!cancelled && cached && !loadoutCache) {
          loadoutCache = cached;
          setLoadoutState(cached);
        }
      })
      .catch((err: unknown) => reportError(err, 'useLoadout.readPrefsCache'));

    // 2. Authoritative read from SQLite
    readLoadout()
      .then((row) => {
        if (!cancelled) setLoadoutState(row);
      })
      .catch((err) => reportError(err, 'useLoadout.read'));

    // Subscribe to changes
    const refresh = () => {
      if (!cancelled) setLoadoutState(loadoutCache);
    };
    listeners.add(refresh);
    return () => {
      cancelled = true;
      listeners.delete(refresh);
    };
  }, []);

  const equip = useCallback(async (kind: UnlockKind, slug: string) => {
    try {
      await equipItem(kind, slug);
      setLoadoutState(loadoutCache);
    } catch (err) {
      reportError(err, 'useLoadout.equip');
    }
  }, []);

  return { loadout, equip };
}
