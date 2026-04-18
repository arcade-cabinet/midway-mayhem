import type { CSSProperties, ReactNode } from 'react';
import { color, motion, zLayer } from '../tokens';
import { display, typeStyle } from '../typography';

type Tone = 'zone' | 'alert' | 'celebrate';

interface Props {
  children: ReactNode;
  visible: boolean;
  tone?: Tone;
  testId?: string;
  style?: CSSProperties;
}

const TONE_COLOR: Record<Tone, string> = {
  zone: color.yellow,
  alert: color.red,
  celebrate: color.blue,
};

export function Banner({ children, visible, tone = 'zone', testId, style }: Props) {
  return (
    <div
      data-testid={testId}
      aria-hidden={!visible}
      style={{
        position: 'absolute',
        top: '15%',
        left: '50%',
        transform: `translate(-50%, 0) scale(${visible ? 1 : 0.9})`,
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden',
        transition: `opacity ${motion.slow}ms ${motion.easing.out}, transform ${motion.slow}ms ${motion.easing.out}`,
        pointerEvents: 'none',
        color: TONE_COLOR[tone],
        ...typeStyle(display.banner),
        textShadow: `4px 4px 0 rgba(0,0,0,0.7), 0 0 24px rgba(255,214,0,0.4)`,
        zIndex: zLayer.banner,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
