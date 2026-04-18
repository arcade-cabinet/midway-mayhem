/**
 * React hook that mirrors persisted game settings and re-renders when
 * any setting changes. Subscribes to the `mm:settingsChanged` window
 * event so updates from SettingsPanel propagate live into App / HUD /
 * cockpit surfaces without a reload.
 *
 * Returns `null` on the first render while the SQLite read resolves;
 * consumers render their default behavior until then.
 */
import { useEffect, useState } from 'react';
import { reportError } from '@/game/errorBus';
import { type GameSettings, getSettings, SETTINGS_CHANGED_EVENT } from '@/persistence/settings';

export function useSettings(): GameSettings | null {
  const [settings, setSettings] = useState<GameSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch((err: unknown) => reportError(err, 'useSettings.getSettings'));

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<GameSettings>).detail;
      if (detail) setSettings(detail);
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, handler);
    return () => {
      cancelled = true;
      window.removeEventListener(SETTINGS_CHANGED_EVENT, handler);
    };
  }, []);

  return settings;
}
