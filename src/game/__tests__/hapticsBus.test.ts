/**
 * hapticsBus unit tests — the silent-on-desktop vibration gateway.
 *
 * Desktop nodejs has no navigator.vibrate, so the web path is a no-op.
 * We stub navigator.vibrate for the "yes, we called it" assertions and
 * verify the enabled flag + the expected per-event pattern shape.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hapticsBus } from '@/game/hapticsBus';

type VibrateFn = (pattern: number | number[]) => boolean;

describe('hapticsBus', () => {
  let calls: Array<number | number[]>;
  let origNav: unknown;

  beforeEach(() => {
    calls = [];
    origNav = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        vibrate: ((pattern: number | number[]) => {
          calls.push(pattern);
          return true;
        }) as VibrateFn,
      },
    });
    hapticsBus.setEnabled(true);
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: origNav,
    });
  });

  it('fires a web-vibrate call for crash-light with pattern 40', () => {
    hapticsBus.fire('crash-light');
    expect(calls).toEqual([40]);
  });

  it('fires a multi-pulse pattern for crash-heavy', () => {
    hapticsBus.fire('crash-heavy');
    expect(calls).toEqual([[80, 30, 40]]);
  });

  it('setEnabled(false) silences subsequent fires', () => {
    hapticsBus.setEnabled(false);
    hapticsBus.fire('crash-light');
    hapticsBus.fire('boost');
    expect(calls).toEqual([]);

    hapticsBus.setEnabled(true);
    hapticsBus.fire('boost');
    expect(calls).toEqual([20]);
  });

  it('zone-transition uses a short 3-pulse pattern', () => {
    hapticsBus.fire('zone-transition');
    expect(calls).toEqual([[20, 40, 20]]);
  });

  it('unknown navigator (no vibrate) is a silent no-op', () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    // Should NOT throw.
    expect(() => hapticsBus.fire('honk')).not.toThrow();
  });
});
