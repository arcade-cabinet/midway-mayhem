import type { CSSProperties, ReactNode } from 'react';
import { color, elevation, layout, radius, safeArea, space } from '../tokens';

export type PanelCorner = 'tl' | 'tr' | 'bl' | 'br' | 'center' | 'none';
export type PanelVariant = 'dark' | 'light' | 'elevated';

interface Props {
  corner?: PanelCorner;
  variant?: PanelVariant;
  minWidth?: number | string;
  children: ReactNode;
  testId?: string;
  style?: CSSProperties;
}

export function Panel({
  corner = 'none',
  variant = 'dark',
  minWidth,
  children,
  testId,
  style,
}: Props) {
  const bg =
    variant === 'dark'
      ? color.surfaceDark
      : variant === 'light'
        ? color.surfaceLight
        : color.surfaceElevated;
  const shadow = variant === 'elevated' ? elevation.float : elevation.panel;

  const cornerStyle: CSSProperties =
    corner === 'none'
      ? {}
      : corner === 'center'
        ? {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }
        : {
            position: 'absolute',
            ...(corner.includes('t')
              ? { top: `calc(${space.lg}px + ${safeArea.top})` }
              : { bottom: `calc(${layout.panelBottomOffset}px + ${safeArea.bottom})` }),
            ...(corner.includes('l')
              ? { left: `calc(${space.lg}px + ${safeArea.left})` }
              : { right: `calc(${space.lg}px + ${safeArea.right})` }),
          };

  return (
    <div
      data-testid={testId}
      style={{
        padding: space.base,
        background: bg,
        border: `2px solid ${color.borderAccent}`,
        borderRadius: radius.md,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        boxShadow: shadow,
        minWidth,
        ...cornerStyle,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
