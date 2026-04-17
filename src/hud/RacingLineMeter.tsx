/**
 * Racing-line cleanliness meter.
 *
 * Reads `state.cleanliness` [0..1] and renders a labelled percentage with
 * a color gradient: red at 0%, yellow at 50%, green at 100%.
 *
 * Intended to be mounted inside <HUD> alongside the existing stat panels.
 */

import { color, radius, space } from '@/design/tokens';
import { typeStyle, ui } from '@/design/typography';
import { useGameStore } from '@/game/gameState';

/** Interpolate between two hex colours given t ∈ [0..1]. */
function lerpColor(from: string, to: string, t: number): string {
  const parse = (hex: string) =>
    [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ] as const;
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

/**
 * Derive a display color from a cleanliness value [0..1]:
 *   0.0 → red   (#E53935)
 *   0.5 → yellow (#FFD600)
 *   1.0 → green  (#43A047)
 */
function cleanlinessColor(v: number): string {
  if (v <= 0.5) {
    return lerpColor('#E53935', '#FFD600', v * 2);
  }
  return lerpColor('#FFD600', '#43A047', (v - 0.5) * 2);
}

export function RacingLineMeter() {
  const cleanliness = useGameStore((s) => s.cleanliness);
  const running = useGameStore((s) => s.running);

  if (!running) return null;

  const pct = Math.round(cleanliness * 100);
  const barColor = cleanlinessColor(cleanliness);

  return (
    <div
      data-testid="racing-line-meter"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: space.xs,
        minWidth: 80,
      }}
    >
      <div style={{ ...typeStyle(ui.label), color: color.blue }}>LINE</div>
      <div
        style={{
          ...typeStyle(ui.body),
          color: barColor,
          fontWeight: 700,
          fontSize: '1.1rem',
          lineHeight: 1,
        }}
      >
        {pct}%
      </div>
      {/* Progress bar */}
      <div
        style={{
          height: 4,
          borderRadius: radius.pill,
          background: 'rgba(255,255,255,0.12)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: barColor,
            borderRadius: radius.pill,
            transition: 'width 0.15s ease, background 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}
