import { type CSSProperties, forwardRef, type ReactNode } from 'react';
import { color, elevation, radius, space } from '../tokens';
import { display, typeStyle } from '../typography';

type Kind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'balloon';
type Size = 'sm' | 'md' | 'lg';
export type BalloonHue = 'red' | 'yellow' | 'blue' | 'purple' | 'orange' | 'green';

interface Props {
  kind?: Kind;
  size?: Size;
  /** For kind="balloon" — picks the fill color from the brand palette. */
  hue?: BalloonHue;
  onClick?: () => void;
  children: ReactNode;
  testId?: string;
  style?: CSSProperties;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

const PADDING: Record<Size, string> = {
  sm: `${space.sm}px ${space.base}px`,
  md: `${space.md}px ${space.xl}px`,
  lg: `${space.base}px ${space.xxl}px`,
};

const TYPE_SIZE: Record<Size, string> = {
  sm: '1rem',
  md: '1.5rem',
  lg: '2rem',
};

const BALLOON_FILL: Record<BalloonHue, string> = {
  red: color.red,
  yellow: color.yellow,
  blue: color.blue,
  purple: color.purple,
  orange: color.orange,
  green: '#43a047',
};

// Text color chosen per fill so contrast stays high and brand reads right.
const BALLOON_TEXT: Record<BalloonHue, string> = {
  red: color.white,
  yellow: color.night,
  blue: color.white,
  purple: color.white,
  orange: color.night,
  green: color.white,
};

export const BrandButton = forwardRef<HTMLButtonElement, Props>(function BrandButton(
  {
    kind = 'primary',
    size = 'md',
    hue,
    onClick,
    children,
    testId,
    style,
    disabled,
    type = 'button',
  },
  ref,
) {
  const scheme = (() => {
    switch (kind) {
      case 'primary':
        return {
          bg: color.red,
          color: color.white,
          border: color.yellow,
          shadow: elevation.glow,
        };
      case 'balloon': {
        const h = hue ?? 'red';
        return {
          bg: BALLOON_FILL[h],
          color: BALLOON_TEXT[h],
          border: color.yellow,
          shadow: elevation.glow,
        };
      }
      case 'secondary':
        return {
          bg: 'transparent',
          color: color.blue,
          border: color.blue,
          shadow: 'none',
        };
      case 'danger':
        return {
          bg: color.red,
          color: color.white,
          border: color.yellow,
          shadow: elevation.danger,
        };
      case 'ghost':
        return {
          bg: 'transparent',
          color: color.dim,
          border: 'rgba(255,255,255,0.2)',
          shadow: 'none',
        };
    }
  })();

  return (
    <button
      ref={ref}
      data-testid={testId}
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: PADDING[size],
        background: scheme.bg,
        border: `2px solid ${scheme.border}`,
        borderRadius: radius.md,
        color: scheme.color,
        ...typeStyle(display.button),
        fontSize: TYPE_SIZE[size],
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        boxShadow: scheme.shadow,
        pointerEvents: 'auto',
        ...style,
      }}
    >
      {children}
    </button>
  );
});
