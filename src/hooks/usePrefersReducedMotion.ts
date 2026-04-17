/**
 * @hook usePrefersReducedMotion
 *
 * Returns true when reduced-motion is preferred, combining two sources:
 *   1. CSS `prefers-reduced-motion: reduce` media query (OS-level)
 *   2. `settings.reducedMotion` persisted in Capacitor Preferences (user override)
 *
 * The settings override takes precedence when present: if the user has explicitly
 * toggled Reduced Motion in Settings, that wins over the OS setting.
 *
 * Updates reactively when the media query changes or the settings CustomEvent fires.
 */

import { useEffect, useState } from 'react';
import { type GameSettings, SETTINGS_CHANGED_EVENT } from '@/persistence/settings';

function mediaQueryMatches(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => mediaQueryMatches());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Media query listener
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMqChange = (e: MediaQueryListEvent) => {
      setReduced(e.matches);
    };

    // Settings override listener
    const onSettingsChanged = (e: Event) => {
      const settings = (e as CustomEvent<GameSettings>).detail;
      if (typeof settings?.reducedMotion === 'boolean') {
        setReduced(settings.reducedMotion);
      }
    };

    mq.addEventListener('change', onMqChange);
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);

    // Eagerly check the persisted setting — async, best-effort
    import('@/persistence/settings').then(({ getSettings }) => {
      getSettings()
        .then((s) => {
          // Only override if the setting explicitly differs from mq
          setReduced(s.reducedMotion ?? mediaQueryMatches());
        })
        .catch(() => {
          // non-critical — fall back to media query value
        });
    });

    return () => {
      mq.removeEventListener('change', onMqChange);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
    };
  }, []);

  return reduced;
}

/**
 * Synchronous snapshot — for use inside useFrame callbacks or outside React.
 * Reads the media query directly; does NOT read persisted settings.
 * Use the hook for reactive updates.
 */
export function prefersReducedMotionNow(): boolean {
  return mediaQueryMatches();
}
