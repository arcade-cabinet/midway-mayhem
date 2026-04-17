import type { CSSProperties, ReactNode } from 'react';
import { color, elevation, radius, space } from '../tokens';
import { display, typeStyle } from '../typography';

type Kind = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  kind?: Kind;
  size?: Size;
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

export function BrandButton({
  kind = 'primary',
  size = 'md',
  onClick,
  children,
  testId,
  style,
  disabled,
  type = 'button',
}: Props) {
  const scheme = (() => {
    switch (kind) {
      case 'primary':
        return {
          bg: color.red,
          color: color.white,
          border: color.yellow,
          shadow: elevation.glow,
        };
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
}
