import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @capacitor/preferences before importing tutorial
const _store = new Map<string, string>();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: _store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      _store.set(key, value);
    },
    remove: async ({ key }: { key: string }) => {
      _store.delete(key);
    },
    clear: async () => {
      _store.clear();
    },
  },
}));

// Import AFTER mocks
import {
  getFirstSeenAt,
  hydrateTutorialFlags,
  markShown,
  resetTutorialForTests,
  shouldShow,
} from '../tutorial';

beforeEach(() => {
  _store.clear();
  resetTutorialForTests();
});

describe('shouldShow — before hydration', () => {
  it('returns true for any slug when cache is empty', () => {
    expect(shouldShow('first-honk')).toBe(true);
    expect(shouldShow('first-ramp')).toBe(true);
    expect(shouldShow('plunge-explained')).toBe(true);
  });
});

describe('markShown + shouldShow', () => {
  it('shouldShow returns false after markShown', async () => {
    expect(shouldShow('first-honk')).toBe(true);
    await markShown('first-honk');
    expect(shouldShow('first-honk')).toBe(false);
  });

  it('marking one slug does not affect others', async () => {
    await markShown('first-honk');
    expect(shouldShow('first-ramp')).toBe(true);
    expect(shouldShow('first-scare')).toBe(true);
  });

  it('getFirstSeenAt returns null before marking', () => {
    expect(getFirstSeenAt('first-honk')).toBeNull();
  });

  it('getFirstSeenAt returns a timestamp after marking', async () => {
    const before = Date.now();
    await markShown('first-honk');
    const at = getFirstSeenAt('first-honk');
    expect(at).not.toBeNull();
    expect(at!).toBeGreaterThanOrEqual(before);
  });
});

describe('hydrateTutorialFlags', () => {
  it('loads previously-stored flags from Preferences', async () => {
    // Simulate a previous session: store the flag in Preferences directly
    const now = Date.now();
    _store.set('mm_tutorial_first-honk', String(now));

    // Reset in-memory cache (simulates fresh session)
    resetTutorialForTests();
    expect(shouldShow('first-honk')).toBe(true); // cache empty, not loaded yet

    // Hydrate
    await hydrateTutorialFlags();
    expect(shouldShow('first-honk')).toBe(false); // now loaded
  });

  it('is idempotent — second call does not reset cache', async () => {
    await markShown('first-ramp');
    await hydrateTutorialFlags(); // second call
    expect(shouldShow('first-ramp')).toBe(false); // still seen
  });
});

describe('shouldShow → markShown → shouldShow = false (full cycle)', () => {
  it('full round-trip: true → mark → false', async () => {
    expect(shouldShow('first-trick')).toBe(true);
    await markShown('first-trick');
    expect(shouldShow('first-trick')).toBe(false);
  });

  it('all 7 slugs can be marked and checked', async () => {
    const slugs = [
      'first-honk',
      'first-ramp',
      'first-scare',
      'first-trick',
      'first-pickup-mega',
      'first-zone-transition',
      'plunge-explained',
    ] as const;

    for (const slug of slugs) {
      expect(shouldShow(slug)).toBe(true);
    }

    for (const slug of slugs) {
      await markShown(slug);
    }

    for (const slug of slugs) {
      expect(shouldShow(slug)).toBe(false);
    }
  });
});
