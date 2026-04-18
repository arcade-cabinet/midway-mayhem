import type { CSSProperties, ReactNode } from 'react';
import { color, zLayer } from '../tokens';
import { font } from '../typography';

interface Props {
  children: ReactNode;
  style?: CSSProperties;
  testId?: string;
}

/**
 * HUD layout wrapper — absolute-positioned over the Canvas, non-interactive
 * except where children explicitly opt-in with pointerEvents:'auto'.
 */
export function HUDFrame({ children, style, testId }: Props) {
  return (
    <div
      data-testid={testId}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        fontFamily: font.ui,
        color: color.white,
        zIndex: zLayer.hud,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
