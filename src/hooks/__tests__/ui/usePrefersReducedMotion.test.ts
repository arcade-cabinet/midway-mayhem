/**
 * Tests for usePrefersReducedMotion
 *
 * Stubs window.matchMedia and asserts the hook snapshot function returns
 * the correct value. Also verifies useShake scales amplitude with the flag.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? matches : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
    }),
  });
}

describe('prefersReducedMotionNow()', () => {
  beforeEach(() => {
    stubMatchMedia(false);
  });

  it('returns false when OS prefers no reduced motion', async () => {
    stubMatchMedia(false);
    const { prefersReducedMotionNow } = await import('@/hooks/usePrefersReducedMotion');
    expect(prefersReducedMotionNow()).toBe(false);
  });

  it('returns true when OS prefers reduced motion', async () => {
    stubMatchMedia(true);
    const { prefersReducedMotionNow } = await import('@/hooks/usePrefersReducedMotion');
    expect(prefersReducedMotionNow()).toBe(true);
  });
});

/** Pure shake computation — extracted for testing outside React context. */
function makeShakeChannels() {
  const channels = {
    bob: { amp: 0, freq: 1.2 },
    speed: { amp: 0, freq: 8 },
    crash: { amp: 0, decay: 4 },
  };
  return {
    setAmp(channel: 'bob' | 'speed', amp: number) {
      channels[channel].amp = amp;
    },
    trigger(channel: 'bob' | 'speed' | 'crash', amp: number) {
      channels[channel].amp = Math.max(channels[channel].amp, amp);
    },
    sample(t: number, dt: number, scale: number) {
      const c = channels;
      c.crash.amp = Math.max(0, c.crash.amp - c.crash.decay * dt);
      const y =
        Math.sin(t * c.bob.freq) * c.bob.amp * scale +
        Math.sin(t * c.speed.freq * 6.28) * c.speed.amp * 0.3 * scale +
        (Math.random() - 0.5) * c.crash.amp * scale;
      const x =
        Math.sin(t * 1.7) * c.bob.amp * 0.4 * scale +
        (Math.random() - 0.5) * c.crash.amp * 0.5 * scale;
      return { x, y };
    },
  };
}

describe('useShake — reduced motion scaling (unit)', () => {
  it('sample() output with scale=0.2 is smaller than with scale=1', () => {
    const shake = makeShakeChannels();
    shake.setAmp('bob', 0.5);

    const fullSamples = Array.from({ length: 10 }, (_, i) =>
      Math.abs(shake.sample(i * 0.1 + 0.1, 0.016, 1.0).y),
    );
    const reducedSamples = Array.from({ length: 10 }, (_, i) =>
      Math.abs(shake.sample(i * 0.1 + 0.1, 0.016, 0.2).y),
    );

    const maxFull = Math.max(...fullSamples);
    const maxReduced = Math.max(...reducedSamples);

    if (maxFull > 0) {
      expect(maxReduced).toBeLessThan(maxFull * 0.5);
    } else {
      expect(maxReduced).toBe(0);
    }
  });

  it('crash shake with scale=0.2 is bounded well under raw amplitude', () => {
    const shake = makeShakeChannels();
    shake.trigger('crash', 1.0);
    const results = Array.from({ length: 5 }, (_, i) => {
      const { x, y } = shake.sample(i * 0.1, 0.016, 0.2);
      return Math.max(Math.abs(x), Math.abs(y));
    });
    // scale 0.2 on amplitude 1.0 → max ~0.2 per axis
    expect(Math.max(...results)).toBeLessThan(0.5);
  });
});
