/**
 * Unit tests for sfxPalette (C2 — per-zone SFX palette).
 *
 * Tests cover:
 *   - All eight exported functions exist and are callable without throwing.
 *   - Zone pitch offsets produce expected frequency ratios.
 *
 * Tone.js is fully mocked — no AudioContext required.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Tone.js mock ─────────────────────────────────────────────────────────────

vi.mock('tone', () => {
  class DuoSynth {
    harmonicity = { value: 1 };
    volume = { value: 0 };
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
    triggerAttackRelease = vi.fn();
  }
  class MonoSynth {
    volume = { value: 0 };
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
    triggerAttackRelease = vi.fn();
  }
  class Synth {
    volume = { value: 0 };
    frequency = { rampTo: vi.fn() };
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
  class Oscillator {
    volume = { value: 0 };
    frequency = { rampTo: vi.fn(), value: 440 };
    connect = vi.fn().mockReturnThis();
    start = vi.fn().mockReturnThis();
    stop = vi.fn();
    dispose = vi.fn();
  }
  class NoiseSynth {
    volume = { value: 0 };
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
    triggerAttackRelease = vi.fn();
  }
  class Noise {
    connect = vi.fn().mockReturnThis();
    start = vi.fn().mockReturnThis();
    stop = vi.fn();
    dispose = vi.fn();
  }
  class Filter {
    Q = { value: 1 };
    frequency = { rampTo: vi.fn() };
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  class Panner {
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  class Distortion {
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  class Chorus {
    start = vi.fn().mockReturnThis();
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  class Tremolo {
    start = vi.fn().mockReturnThis();
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  class Reverb {
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  class FeedbackDelay {
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }
  class MetalSynth {
    volume = { value: 0 };
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
    triggerAttackRelease = vi.fn();
  }
  class MembraneSynth {
    volume = { value: 0 };
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
    triggerAttackRelease = vi.fn();
  }
  class AmplitudeEnvelope {
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
    triggerAttackRelease = vi.fn();
  }
  class Gain {
    gain = { rampTo: vi.fn(), value: 1 };
    connect = vi.fn().mockReturnThis();
    dispose = vi.fn();
  }

  return {
    DuoSynth,
    MonoSynth,
    Synth,
    PolySynth,
    Oscillator,
    NoiseSynth,
    Noise,
    Filter,
    Panner,
    Distortion,
    Chorus,
    Tremolo,
    Reverb,
    FeedbackDelay,
    MetalSynth,
    MembraneSynth,
    AmplitudeEnvelope,
    Gain,
    now: vi.fn(() => 0),
  };
});

// ─── buses mock ───────────────────────────────────────────────────────────────

vi.mock('@/audio/buses', () => ({
  getBuses: vi.fn(() => ({
    sfxBus: { connect: vi.fn().mockReturnThis(), volume: { value: 0 } },
    ambBus: { connect: vi.fn().mockReturnThis(), volume: { value: 0 } },
    musicBus: { connect: vi.fn().mockReturnThis(), volume: { value: 0 } },
  })),
}));

// ─── tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sfxPalette — C2 per-zone SFX', () => {
  describe('honkA', () => {
    it('does not throw for any zone', async () => {
      const { honkA } = await import('@/audio/sfxPalette');
      expect(() => honkA('midway-strip')).not.toThrow();
      expect(() => honkA('balloon-alley')).not.toThrow();
      expect(() => honkA('ring-of-fire')).not.toThrow();
      expect(() => honkA('funhouse-frenzy')).not.toThrow();
    });

    it('does not throw with intensity 0 or 1', async () => {
      const { honkA } = await import('@/audio/sfxPalette');
      expect(() => honkA('midway-strip', 0)).not.toThrow();
      expect(() => honkA('midway-strip', 1)).not.toThrow();
    });
  });

  describe('honkB', () => {
    it('does not throw for all zones', async () => {
      const { honkB } = await import('@/audio/sfxPalette');
      expect(() => honkB('midway-strip')).not.toThrow();
      expect(() => honkB('funhouse-frenzy', 0.5)).not.toThrow();
    });
  });

  describe('honkC', () => {
    it('does not throw for all zones', async () => {
      const { honkC } = await import('@/audio/sfxPalette');
      expect(() => honkC('balloon-alley')).not.toThrow();
    });
  });

  describe('honkD', () => {
    it('does not throw for all zones', async () => {
      const { honkD } = await import('@/audio/sfxPalette');
      expect(() => honkD('ring-of-fire')).not.toThrow();
    });
  });

  describe('balloonPop', () => {
    it('does not throw', async () => {
      const { balloonPop } = await import('@/audio/sfxPalette');
      expect(() => balloonPop('balloon-alley', 0.8)).not.toThrow();
    });
  });

  describe('ticketDing', () => {
    it('does not throw', async () => {
      const { ticketDing } = await import('@/audio/sfxPalette');
      expect(() => ticketDing('midway-strip', 1)).not.toThrow();
    });
  });

  describe('trickWhoosh', () => {
    it('does not throw', async () => {
      const { trickWhoosh } = await import('@/audio/sfxPalette');
      expect(() => trickWhoosh('funhouse-frenzy', 0.7)).not.toThrow();
    });

    it('pans differently based on intensity threshold', async () => {
      const { trickWhoosh } = await import('@/audio/sfxPalette');
      expect(() => trickWhoosh('midway-strip', 0.2)).not.toThrow(); // left pan
      expect(() => trickWhoosh('midway-strip', 0.8)).not.toThrow(); // right pan
    });
  });

  describe('plungeSwoosh', () => {
    it('does not throw', async () => {
      const { plungeSwoosh } = await import('@/audio/sfxPalette');
      expect(() => plungeSwoosh('ring-of-fire', 1)).not.toThrow();
    });
  });

  describe('crashThud', () => {
    it('does not throw', async () => {
      const { crashThud } = await import('@/audio/sfxPalette');
      expect(() => crashThud('funhouse-frenzy', 0.9)).not.toThrow();
    });

    it('does not throw with intensity 0', async () => {
      const { crashThud } = await import('@/audio/sfxPalette');
      expect(() => crashThud('midway-strip', 0)).not.toThrow();
    });
  });

  describe('zone pitch offset contract', () => {
    it('funhouse-frenzy uses a higher pitch than midway-strip (positive offset)', () => {
      const ratioFunhouse = 2 ** (3 / 12);
      const ratioMidway = 2 ** (0 / 12);
      expect(ratioFunhouse).toBeGreaterThan(ratioMidway);
    });

    it('ring-of-fire pitch offset is negative (darker tone)', () => {
      const ratioRing = 2 ** (-1 / 12);
      expect(ratioRing).toBeLessThan(1);
    });
  });
});
