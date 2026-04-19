/**
 * @module ui/title/TitleScreen
 *
 * Title screen orchestrator. Manages overlay state, keyboard shortcuts,
 * DB load, and autoplay. Delegates rendering to TitleCompactLayout (phone)
 * or TitleHeroLayout (tablet/desktop).
 */
import { useEffect, useRef, useState } from 'react';
import { initAudioBusSafely } from '@/audio/audioBus';
import type { Difficulty } from '@/game/difficulty';
import { DEFAULT_DIFFICULTY, DIFFICULTY_PROFILES } from '@/game/difficulty';
import { reportError } from '@/game/errorBus';
import { useFormFactor } from '@/hooks/useFormFactor';
import { useTitleKeyboard } from '@/hooks/useTitleKeyboard';
import { initDb } from '@/persistence/db';
import { getProfile } from '@/persistence/profile';
import { AchievementsPanel } from '@/ui/panels/AchievementsPanel';
import { CreditsPanel } from '@/ui/panels/CreditsPanel';
import { HowToPlayPanel } from '@/ui/panels/HowToPlayPanel';
import { SettingsPanel } from '@/ui/panels/SettingsPanel';
import { StatsPanel } from '@/ui/panels/StatsPanel';
import { TicketShop } from '@/ui/panels/TicketShop';
import { phraseToSeed, shufflePhrase } from '@/utils/seedPhrase';
import { type NewRunConfig, NewRunModal } from './NewRunModal';
import { TitleCompactLayout, type TitleOverlay } from './TitleCompactLayout';
import { TitleHeroLayout } from './TitleHeroLayout';

interface TitleScreenProps {
  onStart: (config?: NewRunConfig) => void;
}

export function TitleScreen({ onStart }: TitleScreenProps) {
  const [overlay, setOverlay] = useState<TitleOverlay>('none');
  const [tickets, setTickets] = useState(0);
  const startButtonRef = useRef<HTMLButtonElement | null>(null);
  const formFactor = useFormFactor();
  const compact = formFactor.tier === 'phone-portrait' || formFactor.tier === 'phone-landscape';

  useEffect(() => {
    startButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (overlay === 'none') {
      startButtonRef.current?.focus();
    }
  }, [overlay]);

  const beginRun = (config?: NewRunConfig) => {
    initAudioBusSafely();
    onStart(config);
  };

  useTitleKeyboard({
    onStart: () => {
      if (overlay === 'none') setOverlay('new-run');
    },
    onShop: () => {
      if (overlay === 'none') setOverlay('shop');
    },
    onEsc: () => {
      setOverlay('none');
    },
  });

  // `?autoplay=1` commits a NewRunConfig programmatically (for e2e testing +
  // governor autonomous playthroughs). Optional `&phrase=<seed>` and
  // `&difficulty=<tier>` override the defaults; with no overrides we generate
  // a random phrase so each run is unique.
  // biome-ignore lint/correctness/useExhaustiveDependencies: boot-time autoplay, fire-and-forget — beginRun is intentionally not in deps
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autoplay') !== '1') return;
    const phraseParam = params.get('phrase');
    const diffParam = params.get('difficulty') as Difficulty | null;
    const phrase = phraseParam ?? shufflePhrase().phrase;
    const difficulty: Difficulty =
      diffParam && diffParam in DIFFICULTY_PROFILES ? diffParam : DEFAULT_DIFFICULTY;
    beginRun({
      seed: phraseToSeed(phrase),
      seedPhrase: phrase,
      difficulty,
      permadeath: false,
    });
  }, []);

  useEffect(() => {
    async function load() {
      try {
        await initDb();
        const p = await getProfile();
        setTickets(p.tickets);
      } catch (err) {
        reportError(err, 'TitleScreen.loadTickets');
      }
    }
    load();
  }, []);

  const overlays = (
    <>
      {overlay === 'new-run' && (
        <NewRunModal
          onClose={() => setOverlay('none')}
          onPlay={(cfg) => {
            setOverlay('none');
            beginRun(cfg);
          }}
        />
      )}
      {overlay === 'shop' && (
        <TicketShop
          tickets={tickets}
          onClose={() => setOverlay('none')}
          onTicketsChange={setTickets}
        />
      )}
      {overlay === 'achievements' && <AchievementsPanel onClose={() => setOverlay('none')} />}
      {overlay === 'settings' && <SettingsPanel onClose={() => setOverlay('none')} />}
      {overlay === 'how-to-play' && <HowToPlayPanel onClose={() => setOverlay('none')} />}
      {overlay === 'credits' && <CreditsPanel onClose={() => setOverlay('none')} />}
      {overlay === 'stats' && <StatsPanel onClose={() => setOverlay('none')} />}
    </>
  );

  if (compact) {
    return (
      <TitleCompactLayout
        orientation={formFactor.isPortrait ? 'portrait' : 'landscape'}
        tickets={tickets}
        onStart={() => setOverlay('new-run')}
        onOpen={setOverlay}
        startButtonRef={startButtonRef}
      >
        {overlays}
      </TitleCompactLayout>
    );
  }

  return (
    <TitleHeroLayout
      tickets={tickets}
      onStart={() => setOverlay('new-run')}
      onOpen={setOverlay}
      startButtonRef={startButtonRef}
    >
      {overlays}
    </TitleHeroLayout>
  );
}
