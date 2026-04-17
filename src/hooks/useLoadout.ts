/**
 * @module hooks/useLoadout
 *
 * Zustand store for the active cockpit loadout.
 *
 * Source of truth: SQLite `loadout` table (via persistence/profile.ts).
 * Cold-start cache: @capacitor/preferences mirror so Cockpit.tsx can apply
 *   loadout synchronously on first render — avoids a 1-frame default flash.
 *
 * Boot flow:
 *   1. initLoadout() reads Preferences cache synchronously (if present) and
 *      sets initial state immediately.
 *   2. Then reads SQLite loadout (authoritative) and updates store + cache.
 *
 * Equip flow:
 *   1. setLoadout() updates SQLite.
 *   2. Updates Preferences cache.
 *   3. Updates zustand store.
 */
import { create } from 'zustand';
import type { UnlockKind } from '../persistence/schema';
import { getLoadout, setLoadout, type LoadoutRow } from '../persistence/profile';
import { PREF_KEYS, prefGetJSON, prefSetJSON } from '../persistence/preferences';
import { reportError } from '../systems/errorBus';
import { setHornSlug } from '../systems/honkBus';

export interface LoadoutStore {
  loadout: LoadoutRow | null;
  /** Call after initDb() at app boot. Seeds from Prefs cache then SQLite. */
  initLoadout: () => Promise<void>;
  /** Equip a slug for the given kind — persists to SQLite + Prefs cache. */
  equip: (kind: UnlockKind, slug: string) => Promise<void>;
}

export const useLoadoutStore = create<LoadoutStore>((set) => ({
  loadout: null,

  async initLoadout() {
    // 1. Synchronous-ish prefs cache hit (reduces first-frame flash)
    try {
      const cached = await prefGetJSON<LoadoutRow>(PREF_KEYS.LOADOUT_CACHE);
      if (cached) set({ loadout: cached });
    } catch {
      // cache miss is fine
    }

    // 2. Authoritative SQLite read
    try {
      const row = await getLoadout();
      set({ loadout: row });
      setHornSlug(row.horn);
      // Keep cache fresh
      await prefSetJSON(PREF_KEYS.LOADOUT_CACHE, row);
    } catch (err) {
      reportError(err, 'useLoadout.initLoadout');
    }
  },

  async equip(kind, slug) {
    const partial: Partial<LoadoutRow> = {};
    switch (kind) {
      case 'palette':     partial.palette   = slug; break;
      case 'ornament':    partial.ornament  = slug; break;
      case 'horn':        partial.horn      = slug; break;
      case 'horn_shape':  partial.hornShape = slug; break;
      case 'rim':         partial.rim       = slug; break;
      case 'dice':        partial.dice      = slug; break;
      default: return;
    }
    try {
      // SQLite is source of truth
      await setLoadout(partial);
      const updated = await getLoadout();
      // Sync horn slug to honkBus immediately
      if (kind === 'horn') setHornSlug(slug);
      // Mirror to Preferences for next cold start
      await prefSetJSON(PREF_KEYS.LOADOUT_CACHE, updated);
      set({ loadout: updated });
    } catch (err) {
      reportError(err, 'useLoadout.equip');
    }
  },
}));
