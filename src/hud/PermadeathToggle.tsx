import { color, radius, space } from '@/design/tokens';
import { typeStyle, ui } from '@/design/typography';
import type { DifficultyProfile } from '@/game/difficulty';

interface PermadeathToggleProps {
  profile: DifficultyProfile;
  effectivePerma: boolean;
  onChange: (checked: boolean) => void;
}

export function PermadeathToggle({ profile, effectivePerma, onChange }: PermadeathToggleProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${space.sm}px ${space.md}px`,
        borderRadius: radius.md,
        border: `2px solid ${profile.supportsPermadeath ? color.red : color.borderSubtle}`,
        background: profile.supportsPermadeath ? 'rgba(229,57,53,0.12)' : 'transparent',
      }}
    >
      <div>
        <div
          style={{
            ...typeStyle(ui.body),
            color: profile.supportsPermadeath ? color.white : color.dim,
            fontWeight: 700,
          }}
        >
          💀 PERMADEATH
        </div>
        <div style={{ ...typeStyle(ui.small), color: color.dim }}>
          {profile.forcesPermadeath
            ? 'Forced ON — any collision ends the run.'
            : profile.supportsPermadeath
              ? 'Any collision ends the run. Higher rewards.'
              : 'Unlocks at NIGHTMARE tier.'}
        </div>
      </div>
      <label
        style={{
          position: 'relative',
          display: 'inline-block',
          width: 52,
          height: 28,
          cursor:
            profile.supportsPermadeath && !profile.forcesPermadeath ? 'pointer' : 'not-allowed',
        }}
      >
        <input
          type="checkbox"
          data-testid="permadeath-toggle"
          checked={effectivePerma}
          disabled={!profile.supportsPermadeath || profile.forcesPermadeath}
          onChange={(e) => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: effectivePerma ? color.red : 'rgba(255,255,255,0.15)',
            borderRadius: 999,
            transition: 'background 120ms',
            opacity: profile.supportsPermadeath ? 1 : 0.4,
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 3,
            left: effectivePerma ? 27 : 3,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: color.white,
            transition: 'left 120ms',
          }}
        />
      </label>
    </div>
  );
}
