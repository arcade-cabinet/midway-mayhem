import { useEffect, useState } from 'react';
import { useGameStore } from '../systems/gameState';
import { themeFor } from '../systems/zoneSystem';

export function ZoneBanner() {
  const zone = useGameStore((s) => s.currentZone);
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState('');

  useEffect(() => {
    setLabel(themeFor(zone).name);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, [zone]);

  return (
    <div
      data-testid="zone-banner"
      style={{
        position: 'absolute',
        top: '15%',
        left: '50%',
        transform: `translate(-50%, 0) scale(${visible ? 1 : 0.9})`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease, transform 0.5s ease',
        pointerEvents: 'none',
        color: themeFor(zone).accent,
        fontFamily: 'Bangers, Impact, sans-serif',
        fontSize: 'clamp(2rem, 6vw, 4rem)',
        letterSpacing: '0.06em',
        textShadow: '4px 4px 0 rgba(0,0,0,0.7), 0 0 24px rgba(255,214,0,0.4)',
        zIndex: 30,
      }}
    >
      {label}
    </div>
  );
}
