import { useEffect, useRef, useState } from 'react';
import { Banner } from '@/design/components/Banner';
import type { RaidKind } from '@/game/obstacles/raidDirector';

const RAID_KIND_LABEL: Record<RaidKind, string> = {
  TIGER: '🐯 TIGER ON THE TRACK!',
  KNIVES: '🔪 KNIVES INCOMING!',
  CANNONBALL: '💥 CANNONBALL!',
};

/** Feature B: Shows the 2s telegraph warning when a raid is about to fire. */
export function RaidTelegraphBanner() {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState('');
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const poll = () => {
      // biome-ignore lint/suspicious/noExplicitAny: raid director
      const rd = (window as any).__mmRaidDirector;
      if (rd) {
        const s = rd.getState() as { kind: RaidKind; phase: string } | null;
        const show = s !== null && s.phase === 'telegraph';
        setVisible(show);
        if (show) setLabel(RAID_KIND_LABEL[s?.kind] ?? '');
      }
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <Banner
      visible={visible}
      tone="alert"
      testId="raid-telegraph-banner"
      style={{ top: '25%', fontSize: 'clamp(1.5rem, 5vw, 3rem)' }}
    >
      {label}
    </Banner>
  );
}
