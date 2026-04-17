/**
 * @module modes/tour/TourMobileJoystick
 *
 * Dual virtual thumb-stick overlay for BigTopTour on mobile devices.
 * Left stick = move, right stick = look. Rendered as HTML outside the Canvas.
 * Extracted from BigTopTour.tsx to keep that file under 300 LOC.
 */
import { useEffect, useRef, useState } from 'react';
import { color, zLayer } from '@/design/tokens';
import type { useWalkControls } from '@/hooks/useWalkControls';

export interface TourMobileJoystickProps {
  joystick: ReturnType<typeof useWalkControls>['joystick'];
}

const STICK_RADIUS = 36;

export function TourMobileJoystick({ joystick }: TourMobileJoystickProps) {
  const leftOrigin = useRef({ x: 0, y: 0 });
  const rightOrigin = useRef({ x: 0, y: 0 });
  const [leftThumb, setLeftThumb] = useState({ x: 0, y: 0 });
  const [rightThumb, setRightThumb] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(
      typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
    );
  }, []);

  if (!visible) return null;

  const handleTouchStart = (side: 'left' | 'right', e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t) return;
    if (side === 'left') leftOrigin.current = { x: t.clientX, y: t.clientY };
    else rightOrigin.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchMove = (side: 'left' | 'right', e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t) return;
    const origin = side === 'left' ? leftOrigin.current : rightOrigin.current;
    const dx = Math.max(-1, Math.min(1, (t.clientX - origin.x) / 60));
    const dy = Math.max(-1, Math.min(1, (t.clientY - origin.y) / 60));
    if (side === 'left') {
      setLeftThumb({ x: dx, y: dy });
      joystick.setMoveStick(dx, dy);
    } else {
      setRightThumb({ x: dx, y: dy });
      joystick.setLookStick(dx, dy);
    }
  };

  const handleTouchEnd = (side: 'left' | 'right') => {
    if (side === 'left') {
      setLeftThumb({ x: 0, y: 0 });
      joystick.setMoveStick(0, 0);
    } else {
      setRightThumb({ x: 0, y: 0 });
      joystick.setLookStick(0, 0);
    }
  };

  const Stick = ({ side, thumb }: { side: 'left' | 'right'; thumb: { x: number; y: number } }) => (
    <div
      data-testid={`joystick-${side}`}
      onTouchStart={(e) => handleTouchStart(side, e)}
      onTouchMove={(e) => handleTouchMove(side, e)}
      onTouchEnd={() => handleTouchEnd(side)}
      onTouchCancel={() => handleTouchEnd(side)}
      style={{
        position: 'absolute',
        bottom: 24,
        [side === 'left' ? 'left' : 'right']: 16,
        width: 110,
        height: 110,
        borderRadius: '50%',
        background: `${color.night}99`,
        border: `2px solid ${color.yellow}66`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: STICK_RADIUS * 2,
          height: STICK_RADIUS * 2,
          borderRadius: '50%',
          background: `${color.yellow}88`,
          transform: `translate(${thumb.x * 28}px, ${thumb.y * 28}px)`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: zLayer.hud,
      }}
    >
      <Stick side="left" thumb={leftThumb} />
      <Stick side="right" thumb={rightThumb} />
    </div>
  );
}
