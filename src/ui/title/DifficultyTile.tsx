import { color, radius, space } from '@/design/tokens';
import { display, typeStyle, ui } from '@/design/typography';
import { DIFFICULTY_PROFILES, type Difficulty } from '@/game/difficulty';

interface DifficultyTileProps {
  id: Difficulty;
  selected: boolean;
  onSelect: () => void;
}

function accentColorFor(hue: string): string {
  switch (hue) {
    case 'red':
      return color.red;
    case 'yellow':
      return color.yellow;
    case 'blue':
      return color.blue;
    case 'purple':
      return color.purple;
    case 'orange':
      return color.orange;
    case 'green':
      return '#43a047';
    default:
      return color.white;
  }
}

export function DifficultyTile({ id, selected, onSelect }: DifficultyTileProps) {
  const profile = DIFFICULTY_PROFILES[id];
  const accent = accentColorFor(profile.accentHue);

  return (
    // biome-ignore lint/a11y/useSemanticElements: radio behavior on a styled button; radiogroup parent validates
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-testid={`difficulty-tile-${id}`}
      style={{
        textAlign: 'left',
        padding: space.md,
        background: selected ? `${accent}25` : 'rgba(0,0,0,0.35)',
        border: `2px solid ${selected ? accent : color.borderSubtle}`,
        borderRadius: radius.md,
        color: color.white,
        cursor: 'pointer',
        display: 'grid',
        gap: space.xs,
        transition: 'border 120ms, background 120ms',
      }}
    >
      <div
        style={{
          ...typeStyle(display.button),
          fontSize: '1.05rem',
          color: accent,
        }}
      >
        {profile.label}
        {profile.forcesPermadeath && ' 💀'}
      </div>
      <div style={{ ...typeStyle(ui.small), color: color.dim }}>{profile.tagline}</div>
      <div
        style={{
          ...typeStyle(ui.meta),
          color: color.dim,
          display: 'flex',
          gap: space.md,
          marginTop: space.xs,
        }}
      >
        <span>⚡ {profile.targetSpeedMps} m/s</span>
        <span>🎟 ×{profile.rewardMultiplier}</span>
      </div>
    </button>
  );
}
