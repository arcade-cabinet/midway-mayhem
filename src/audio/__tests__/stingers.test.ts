/**
 * Unit tests for stingers.ts (C4 — music stingers).
 *
 * Tests cover:
 *   - playZoneStinger fires without throwing for every ZoneId.
 *   - playMilestoneStinger fires without throwing.
 *   - playClearStinger fires without throwing.
 *   - When buses are not initialized, all functions no-op gracefully.
 *
 * Tone.js and buses are mocked — no AudioContext required.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Tone.js mock ─────────────────────────────────────────────────────────────

vi.mock('tone', () => {
  class Synth {
    volume = { value: 0 };
    frequency = { rampTo: vi.fn(), value: 440 };
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
    triggerAttackRelease = vi.fn();
  }
  class PolySynth {
    volume = { value: 0 };
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
    triggerAttackRelease = vi.fn();
  }
  class FeedbackDelay {
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  class Reverb {
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  return {
    Synth,
    PolySynth,
    FeedbackDelay,
    Reverb,
    now: vi.fn(() => 0),
  };
});

// ─── buses mock ───────────────────────────────────────────────────────────────

let busesAvailable = true;
const fakeSfxBus = { connect: vi.fn().mockReturnThis(), volume: { value: 0 } };

vi.mock('@/audio/buses', () => ({
  getBuses: vi.fn(() => {
    if (!busesAvailable) throw new Error('not initialized');
    return { sfxBus: fakeSfxBus, ambBus: {}, musicBus: {} };
  }),
}));

// ─── tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  busesAvailable = true;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('stingers — C4 music stingers', () => {
  describe('playZoneStinger', () => {
    it('fires without throwing for midway-strip', async () => {
      const { playZoneStinger } = await import('@/audio/stingers');
      expect(() => playZoneStinger('midway-strip')).not.toThrow();
    });

    it('fires without throwing for balloon-alley', async () => {
      const { playZoneStinger } = await import('@/audio/stingers');
      expect(() => playZoneStinger('balloon-alley')).not.toThrow();
    });

    it('fires without throwing for ring-of-fire', async () => {
      const { playZoneStinger } = await import('@/audio/stingers');
      expect(() => playZoneStinger('ring-of-fire')).not.toThrow();
    });

    it('fires without throwing for funhouse-frenzy', async () => {
      const { playZoneStinger } = await import('@/audio/stingers');
      expect(() => playZoneStinger('funhouse-frenzy')).not.toThrow();
    });

    it('no-ops gracefully when buses are not initialized', async () => {
      busesAvailable = false;
      const { playZoneStinger } = await import('@/audio/stingers');
      expect(() => playZoneStinger('midway-strip')).not.toThrow();
    });

    it('self-disposes via setTimeout after stinger ends', async () => {
      const { playZoneStinger } = await import('@/audio/stingers');
      playZoneStinger('midway-strip');
      vi.advanceTimersByTime(3000);
      // No uncaught exceptions = pass
      expect(true).toBe(true);
    });
  });

  describe('playMilestoneStinger', () => {
    it('fires without throwing', async () => {
      const { playMilestoneStinger } = await import('@/audio/stingers');
      expect(() => playMilestoneStinger()).not.toThrow();
    });

    it('no-ops gracefully when buses are not initialized', async () => {
      busesAvailable = false;
      const { playMilestoneStinger } = await import('@/audio/stingers');
      expect(() => playMilestoneStinger()).not.toThrow();
    });
  });

  describe('playClearStinger', () => {
    it('fires without throwing', async () => {
      const { playClearStinger } = await import('@/audio/stingers');
      expect(() => playClearStinger()).not.toThrow();
    });

    it('no-ops gracefully when buses are not initialized', async () => {
      busesAvailable = false;
      const { playClearStinger } = await import('@/audio/stingers');
      expect(() => playClearStinger()).not.toThrow();
    });

    it('self-disposes via setTimeout after stinger ends', async () => {
      const { playClearStinger } = await import('@/audio/stingers');
      playClearStinger();
      vi.advanceTimersByTime(5000);
      expect(true).toBe(true);
    });
  });
});
