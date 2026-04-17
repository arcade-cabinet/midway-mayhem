import type { CSSProperties } from 'react';
import { color, radius } from '../tokens';

type BarColor = 'red' | 'yellow' | 'blue' | 'purple' | 'orange';

const FILL: Record<BarColor, string> = {
  red: color.red,
  yellow: color.yellow,
  blue: color.blue,
  purple: color.purple,
  orange: color.orange,
};

interface Props {
  /** 0..100 */
  value: number;
  tone?: BarColor;
  height?: number;
  testId?: string;
  style?: CSSProperties;
}

export function GaugeBar({ value, tone = 'yellow', height = 8, testId, style }: Props) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      data-testid={testId}
      style={{
        width: '100%',
        height,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: radius.xs,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: FILL[tone],
          transition: 'width 0.2s ease, background 0.2s ease',
        }}
      />
    </div>
  );
}
