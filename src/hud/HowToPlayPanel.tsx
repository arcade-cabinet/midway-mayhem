import { useEffect, useRef } from 'react';
import { BrandButton } from '@/design/components/BrandButton';
import { Dialog } from '@/design/components/Dialog';
import { color, space } from '@/design/tokens';
import { display, typeStyle, ui } from '@/design/typography';

interface Props {
  onClose: () => void;
}

const ROWS: Array<{ what: string; desktop: string; mobile: string }> = [
  {
    what: 'Steer',
    desktop: '← → / A D / mouse drag',
    mobile: 'drag on canvas or swipe left/right',
  },
  { what: 'Honk', desktop: 'Space or H', mobile: 'HONK button or swipe up' },
  { what: 'Pause', desktop: 'P or Esc', mobile: 'pause button' },
  { what: 'Restart', desktop: 'R on game-over', mobile: 'AGAIN! button' },
];

const GOALS: string[] = [
  "Scare critters with HONK — they'll tumble off the track and boost crowd score",
  'Chain scares + pickups + near-misses without getting hit to build the CROWD CHAIN multiplier (1× → 8×)',
  'Hit a ramp edge during a trick input (↑↑ wheelie, ↓↓ handstand, ←→ spin) for bonus crowd + sanity',
  'Obstacles degrade your car — at 0 sanity the run ends in a multicolor clown explosion',
  'Drive off a rail-free ramp and watch the midway meltdown animation',
  'Every ticket earned can be spent on palettes, ornaments, horns, and cockpit rims',
];

export function HowToPlayPanel({ onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Dialog role="dialog" ariaLabel="How to play" testId="how-to-play-panel" tone="info">
      <div style={{ maxWidth: 640, padding: space.xl, display: 'grid', gap: space.lg }}>
        <div style={{ ...typeStyle(display.banner), color: color.yellow }}>HOW TO PLAY</div>

        <div>
          <div style={{ ...typeStyle(ui.label), color: color.blue, marginBottom: space.sm }}>
            CONTROLS
          </div>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              ...typeStyle(ui.body),
            }}
          >
            <thead>
              <tr>
                <th
                  style={{ textAlign: 'left', padding: space.xs, color: color.white, opacity: 0.7 }}
                >
                  Action
                </th>
                <th
                  style={{ textAlign: 'left', padding: space.xs, color: color.white, opacity: 0.7 }}
                >
                  Desktop
                </th>
                <th
                  style={{ textAlign: 'left', padding: space.xs, color: color.white, opacity: 0.7 }}
                >
                  Mobile
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.what} style={{ borderTop: `1px solid ${color.white}20` }}>
                  <td style={{ padding: space.xs, color: color.yellow }}>{r.what}</td>
                  <td style={{ padding: space.xs }}>{r.desktop}</td>
                  <td style={{ padding: space.xs }}>{r.mobile}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div style={{ ...typeStyle(ui.label), color: color.blue, marginBottom: space.sm }}>
            GOALS
          </div>
          <ul style={{ margin: 0, paddingLeft: space.lg, display: 'grid', gap: space.xs }}>
            {GOALS.map((g) => (
              <li key={g} style={{ ...typeStyle(ui.body) }}>
                {g}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <BrandButton
            ref={closeRef}
            kind="primary"
            size="md"
            onClick={onClose}
            testId="how-to-play-close"
          >
            GOT IT
          </BrandButton>
        </div>
      </div>
    </Dialog>
  );
}
