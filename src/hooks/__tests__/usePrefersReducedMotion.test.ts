/**
 * prefersReducedMotionNow unit tests — the synchronous snapshot. The
 * reactive hook is DOM + async-import heavy, so only the pure snapshot
 * function is covered here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotionNow } from '@/hooks/usePrefersReducedMotion';

const GLOBAL = globalThis as Record<string, unknown>;
const ORIG_WINDOW = GLOBAL.window;

function installWindow(matches: boolean) {
  GLOBAL.window = {
    matchMedia: (q: string) => ({
      matches,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }),
  };
}

function uninstallWindow() {
  GLOBAL.window = ORIG_WINDOW;
}

describe('prefersReducedMotionNow', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    uninstallWindow();
  });

  it('returns false when window is undefined (SSR-safe)', () => {
    GLOBAL.window = undefined;
    expect(prefersReducedMotionNow()).toBe(false);
  });

  it('returns true when (prefers-reduced-motion: reduce) matches', () => {
    installWindow(true);
    expect(prefersReducedMotionNow()).toBe(true);
  });

  it('returns false when the media query does NOT match', () => {
    installWindow(false);
    expect(prefersReducedMotionNow()).toBe(false);
  });

  it('reads through matchMedia — queries with the correct CSS string', () => {
    let capturedQuery = '';
    GLOBAL.window = {
      matchMedia: (q: string) => {
        capturedQuery = q;
        return {
          matches: false,
          media: q,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => true,
        };
      },
    };
    prefersReducedMotionNow();
    expect(capturedQuery).toBe('(prefers-reduced-motion: reduce)');
  });

  it('is deterministic within a single media-query state', () => {
    installWindow(true);
    expect(prefersReducedMotionNow()).toBe(prefersReducedMotionNow());
  });
});
