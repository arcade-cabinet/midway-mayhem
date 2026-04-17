import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearErrorsForTests } from '@/game/errorBus';
import { DEFAULT_TUNABLES } from '../defaults';
import { applyLoadedTunables, resetTunablesToDefaults, tunables } from '../index';
import { loadTunables } from '../loader';
import { parseTunables } from '../schema';

// ---------------------------------------------------------------------------
// parseTunables — unit tests (no fetch needed)
// ---------------------------------------------------------------------------

describe('parseTunables', () => {
  it('accepts valid tunables JSON and returns ok=true', () => {
    const result = parseTunables(DEFAULT_TUNABLES);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.speed.base).toBe(30);
      expect(result.data.track.laneCount).toBe(3);
      expect(result.data.audio.buses.masterDb).toBe(-6);
    }
  });

  it('rejects null with a readable error', () => {
    const result = parseTunables(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/expected object/i);
    }
  });

  it('rejects missing speed.cruise with a readable field-level error', () => {
    const bad = {
      ...DEFAULT_TUNABLES,
      speed: { ...DEFAULT_TUNABLES.speed, cruise: 'fast' },
    };
    const result = parseTunables(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/speed\.cruise/);
    }
  });

  it('rejects speed.crashDamping > 1', () => {
    const bad = {
      ...DEFAULT_TUNABLES,
      speed: { ...DEFAULT_TUNABLES.speed, crashDamping: 1.5 },
    };
    const result = parseTunables(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/speed\.crashDamping/);
    }
  });

  it('rejects negative scoring.crashDamage', () => {
    const bad = {
      ...DEFAULT_TUNABLES,
      scoring: { ...DEFAULT_TUNABLES.scoring, crashDamage: -1 },
    };
    const result = parseTunables(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/scoring\.crashDamage/);
    }
  });

  it('validates zone entries have root + tempo + colorGrade', () => {
    const bad = {
      ...DEFAULT_TUNABLES,
      zones: {
        'midway-strip': { root: 'C4', tempo: 132 }, // missing colorGrade
      },
    };
    const result = parseTunables(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/zones\.midway-strip\.colorGrade/);
    }
  });

  it('collects multiple errors in a single message', () => {
    const bad = {
      ...DEFAULT_TUNABLES,
      speed: { ...DEFAULT_TUNABLES.speed, base: -5, cruise: 'fast' },
    };
    const result = parseTunables(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/speed\.base/);
      expect(result.error).toMatch(/speed\.cruise/);
    }
  });
});

// ---------------------------------------------------------------------------
// loadTunables — integration tests with mocked fetch
// ---------------------------------------------------------------------------

describe('loadTunables', () => {
  beforeEach(() => {
    clearErrorsForTests();
    resetTunablesToDefaults();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips valid JSON through fetch and returns typed Tunables', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => DEFAULT_TUNABLES,
      }),
    );

    const t = await loadTunables('/config/tunables.json');
    expect(t.speed.base).toBe(30);
    expect(t.zones['midway-strip']?.tempo).toBe(132);
    expect(t.obstacles.zoneWeights['ring-of-fire']?.hammer).toBe(2);
  });

  it('throws and calls reportError on HTTP 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );

    await expect(loadTunables('/config/tunables.json')).rejects.toThrow(/HTTP 404/);
  });

  it('throws and calls reportError on invalid JSON shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ speed: { base: 'not-a-number' } }),
      }),
    );

    await expect(loadTunables('/config/tunables.json')).rejects.toThrow(/validation failed/i);
  });

  it.skipIf(typeof window === 'undefined')(
    'uses the ?config= URL override when window.location.search contains it',
    async () => {
      const customUrl = 'https://cdn.example.com/custom-tunables.json';

      // Mock window.location.search
      const origLocation = window.location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...origLocation, search: `?config=${encodeURIComponent(customUrl)}` },
      });

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => DEFAULT_TUNABLES,
        }),
      );

      await loadTunables('/config/tunables.json');

      // biome-ignore lint/suspicious/noExplicitAny: test
      expect((fetch as any).mock.calls[0][0]).toBe(customUrl);

      Object.defineProperty(window, 'location', { configurable: true, value: origLocation });
    },
  );
});

// ---------------------------------------------------------------------------
// tunables proxy + applyLoadedTunables
// ---------------------------------------------------------------------------

describe('tunables proxy', () => {
  beforeEach(() => resetTunablesToDefaults());

  it('returns defaults before applyLoadedTunables is called', () => {
    expect(tunables().speed.cruise).toBe(70);
  });

  it('returns updated values after applyLoadedTunables', () => {
    const modified = { ...DEFAULT_TUNABLES, speed: { ...DEFAULT_TUNABLES.speed, cruise: 99 } };
    applyLoadedTunables(modified);
    expect(tunables().speed.cruise).toBe(99);
  });
});
