/**
 * @component SettingsPanel
 *
 * Title-screen settings modal. Persists on every change via updateSettings().
 * Toggles: audio, haptics, reduced-motion, fps, zone-banner, subtitles.
 * Slider: ui_scale_multiplier (0.8–1.4).
 * Radio: preferred_control ('pointer' | 'keyboard' | 'touch' | 'gamepad').
 */

import { useEffect, useRef, useState } from 'react';
import { BrandButton } from '@/design/components/BrandButton';
import { Dialog } from '@/design/components/Dialog';
import { color, space } from '@/design/tokens';
import { typeStyle, ui } from '@/design/typography';
import { reportError } from '@/game/errorBus';
import {
  type GameSettings,
  getSettings,
  type PreferredControl,
  updateSettings,
} from '@/persistence/settings';

interface Props {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: Props) {
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((e) => reportError(e, 'SettingsPanel.load'));
  }, []);

  // Focus close button once settings have loaded (not before the button exists)
  useEffect(() => {
    if (settings) closeButtonRef.current?.focus();
  }, [settings]);

  // Esc closes the panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function patch(partial: Partial<GameSettings>) {
    if (!settings) return;
    const previous = settings;
    const next = { ...settings, ...partial };
    // Optimistic update for responsive UI
    setSettings(next);
    try {
      await updateSettings(partial);
    } catch (e) {
      // Roll back and surface the error
      setSettings(previous);
      reportError(e, 'SettingsPanel.patch');
    }
  }

  if (!settings) {
    return (
      <Dialog tone="info" testId="settings-panel" ariaLabel="Settings">
        <div
          style={{
            ...typeStyle(ui.body),
            color: color.dim,
            textAlign: 'center',
            padding: space.xl,
          }}
        >
          Loading…
        </div>
      </Dialog>
    );
  }

  const CONTROL_OPTIONS: { value: PreferredControl; label: string }[] = [
    { value: 'pointer', label: 'Mouse / Pointer' },
    { value: 'keyboard', label: 'Keyboard' },
    { value: 'touch', label: 'Touch' },
    { value: 'gamepad', label: 'Gamepad' },
  ];

  return (
    <Dialog tone="info" testId="settings-panel" role="dialog" ariaLabel="Settings">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: space.lg,
        }}
      >
        <div
          style={{
            ...typeStyle(ui.label),
            color: color.yellow,
            fontSize: '1.2rem',
            letterSpacing: '0.15em',
          }}
        >
          SETTINGS
        </div>
        <BrandButton
          ref={closeButtonRef}
          kind="ghost"
          size="sm"
          onClick={onClose}
          testId="settings-close"
        >
          CLOSE
        </BrandButton>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: space.base }}>
        {/* Toggles */}
        <SectionLabel>Audio &amp; Feedback</SectionLabel>
        <ToggleRow
          label="Audio"
          checked={settings.audioEnabled}
          testId="setting-audio"
          onChange={(v) => patch({ audioEnabled: v })}
        />
        <ToggleRow
          label="Haptics / Vibration"
          checked={settings.hapticsEnabled}
          testId="setting-haptics"
          onChange={(v) => patch({ hapticsEnabled: v })}
        />
        <ToggleRow
          label="Subtitles"
          checked={settings.subtitles}
          testId="setting-subtitles"
          onChange={(v) => patch({ subtitles: v })}
        />

        <SectionLabel>Display</SectionLabel>
        <ToggleRow
          label="Reduced Motion"
          checked={settings.reducedMotion}
          testId="setting-reduced-motion"
          onChange={(v) => patch({ reducedMotion: v })}
        />
        <ToggleRow
          label="Show FPS Counter"
          checked={settings.showFps}
          testId="setting-fps"
          onChange={(v) => patch({ showFps: v })}
        />
        <ToggleRow
          label="Show Zone Banner"
          checked={settings.showZoneBanner}
          testId="setting-zone-banner"
          onChange={(v) => patch({ showZoneBanner: v })}
        />
        <ToggleRow
          label="Show racing line"
          checked={settings.showRacingLine}
          testId="setting-racing-line"
          onChange={(v) => patch({ showRacingLine: v })}
        />

        {/* UI Scale slider */}
        <SectionLabel>Interface Scale</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              ...typeStyle(ui.body),
              color: color.white,
            }}
          >
            <span>UI Scale</span>
            <span style={{ color: color.yellow }}>{settings.uiScaleMultiplier.toFixed(1)}×</span>
          </div>
          <input
            data-testid="setting-ui-scale"
            type="range"
            min={0.8}
            max={1.4}
            step={0.05}
            value={settings.uiScaleMultiplier}
            onChange={(e) => patch({ uiScaleMultiplier: Number(e.target.value) })}
            style={{ width: '100%', accentColor: color.yellow }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              ...typeStyle(ui.body),
              color: color.dim,
              fontSize: '0.75rem',
            }}
          >
            <span>0.8×</span>
            <span>1.4×</span>
          </div>
        </div>

        {/* Preferred control */}
        <SectionLabel>Preferred Control</SectionLabel>
        <div
          data-testid="setting-control"
          style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}
        >
          {CONTROL_OPTIONS.map(({ value, label }) => (
            <label
              key={value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space.sm,
                cursor: 'pointer',
                ...typeStyle(ui.body),
                color: settings.preferredControl === value ? color.yellow : color.white,
              }}
            >
              <input
                type="radio"
                name="preferred-control"
                value={value}
                checked={settings.preferredControl === value}
                onChange={() => patch({ preferredControl: value })}
                style={{ accentColor: color.yellow }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ...typeStyle(ui.label),
        color: color.dim,
        fontSize: '0.7rem',
        letterSpacing: '0.1em',
        borderBottom: `1px solid rgba(255,255,255,0.1)`,
        paddingBottom: space.xs,
        marginTop: space.xs,
      }}
    >
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  testId,
  onChange,
}: {
  label: string;
  checked: boolean;
  testId: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        ...typeStyle(ui.body),
        color: color.white,
      }}
    >
      <span>{label}</span>
      <input
        data-testid={testId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, accentColor: color.yellow, cursor: 'pointer' }}
      />
    </label>
  );
}
