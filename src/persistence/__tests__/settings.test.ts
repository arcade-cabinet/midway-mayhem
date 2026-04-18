import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @capacitor/preferences before importing settings
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

// Mock hapticsBus to avoid import-chain issues in node env
vi.mock('@/game/hapticsBus', () => ({
  hapticsBus: { setEnabled: vi.fn() },
}));

import type { GameSettings } from '../settings';
// Import AFTER mocks are set up
import { getSettings, updateSettings } from '../settings';

beforeEach(() => {
  _store.clear();
});

afterEach(() => {
  _store.clear();
});

describe('getSettings — defaults', () => {
  it('returns defaults when no value stored', async () => {
    const s = await getSettings();
    expect(s.audioEnabled).toBe(true);
    expect(s.hapticsEnabled).toBe(true);
    expect(s.reducedMotion).toBe(false);
    expect(s.uiScaleMultiplier).toBe(1.0);
    expect(s.preferredControl).toBe('pointer');
    expect(s.showFps).toBe(false);
    expect(s.showZoneBanner).toBe(true);
    expect(s.subtitles).toBe(false);
    expect(s.showRacingLine).toBe(true);
  });
});

describe('updateSettings — round-trip', () => {
  it('persists a single field change', async () => {
    await updateSettings({ audioEnabled: false });
    const s = await getSettings();
    expect(s.audioEnabled).toBe(false);
  });

  it('partial update does not clobber other fields', async () => {
    await updateSettings({ audioEnabled: false });
    await updateSettings({ reducedMotion: true });
    const s = await getSettings();
    expect(s.audioEnabled).toBe(false); // still false
    expect(s.reducedMotion).toBe(true); // newly set
  });

  it('ui_scale_multiplier round-trips correctly', async () => {
    await updateSettings({ uiScaleMultiplier: 1.3 });
    const s = await getSettings();
    expect(s.uiScaleMultiplier).toBeCloseTo(1.3, 5);
  });

  it('preferredControl round-trips correctly', async () => {
    await updateSettings({ preferredControl: 'gamepad' });
    const s = await getSettings();
    expect(s.preferredControl).toBe('gamepad');
  });
});

describe('singleton behavior', () => {
  it('successive reads return the same committed state', async () => {
    await updateSettings({ showFps: true, subtitles: true });
    const a = await getSettings();
    const b = await getSettings();
    expect(a).toEqual(b);
  });

  it('all-fields update round-trips', async () => {
    const full: GameSettings = {
      audioEnabled: false,
      hapticsEnabled: false,
      reducedMotion: true,
      uiScaleMultiplier: 0.9,
      preferredControl: 'touch',
      showFps: true,
      showZoneBanner: false,
      subtitles: true,
      showRacingLine: false,
      nightMode: true,
    };
    await updateSettings(full);
    const result = await getSettings();
    expect(result).toEqual(full);
  });
});

describe('hapticsBus wiring', () => {
  it('calls hapticsBus.setEnabled with the hapticsEnabled value', async () => {
    const { hapticsBus } = await import('@/game/hapticsBus');
    await updateSettings({ hapticsEnabled: false });
    expect(hapticsBus.setEnabled).toHaveBeenCalledWith(false);
  });
});
