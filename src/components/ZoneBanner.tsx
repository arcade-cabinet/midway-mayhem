import { useEffect, useState } from 'react';
import { Banner } from '../design/components/Banner';
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
    <Banner visible={visible} tone="zone" testId="zone-banner">
      {label}
    </Banner>
  );
}
