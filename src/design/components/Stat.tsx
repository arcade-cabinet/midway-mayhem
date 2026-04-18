import type { ReactNode } from 'react';
import { color, space } from '../tokens';
import { display, typeStyle, ui } from '../typography';
import { GaugeBar } from './GaugeBar';

interface Props {
  label: string;
  /** Displayed value — can be formatted string or number */
  value: ReactNode;
  /** Optional unit suffix shown after value (e.g., "m" for meters) */
  unit?: string;
  /** Optional bar beneath the value */
  bar?: { value: number; tone?: 'red' | 'yellow' | 'blue' | 'purple' | 'orange' };
  /** Label color override — defaults to brand blue */
  labelColor?: string;
  /** Value color override — defaults to brand yellow */
  valueColor?: string;
  testId?: string;
}

export function Stat({
  label,
  value,
  unit,
  bar,
  labelColor = color.blue,
  valueColor = color.yellow,
  testId,
}: Props) {
  return (
    <div data-testid={testId}>
      <div style={{ ...typeStyle(ui.label), color: labelColor }}>{label}</div>
      <div
        className="mm-stat-value"
        style={{
          ...typeStyle(display.score),
          color: valueColor,
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: space.xs,
        }}
      >
        {value}
        {unit && <span style={{ ...typeStyle(ui.small), color: valueColor }}>{unit}</span>}
      </div>
      {bar && (
        <div style={{ marginTop: space.xs }}>
          <GaugeBar value={bar.value} tone={bar.tone ?? 'yellow'} />
        </div>
      )}
    </div>
  );
}
