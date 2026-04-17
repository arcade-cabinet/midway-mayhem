import { useEffect, useRef, useState } from 'react';
import { initAudioBusSafely } from '@/audio/audioBus';
import { BrandButton } from '@/design/components/BrandButton';
import { color, space } from '@/design/tokens';
import { typeStyle, ui } from '@/design/typography';
import type { Difficulty } from '@/game/difficulty';
import { DEFAULT_DIFFICULTY, DIFFICULTY_PROFILES } from '@/game/difficulty';
import { reportError } from '@/game/errorBus';
import { useFormFactor } from '@/hooks/useFormFactor';
import { useTitleKeyboard } from '@/hooks/useKeyboardControls';
import { initDb } from '@/persistence/db';
import { getProfile } from '@/persistence/profile';
import { phraseToSeed, shufflePhrase } from '@/utils/seedPhrase';
import { AchievementsPanel } from './AchievementsPanel';
import { CreditsPanel } from './CreditsPanel';
import { HowToPlayPanel } from './HowToPlayPanel';
import { Leaderboard } from './Leaderboard';
import { type NewRunConfig, NewRunModal } from './NewRunModal';
import { SettingsPanel } from './SettingsPanel';
import { StatsPanel } from './StatsPanel';
import { TicketShop } from './TicketShop';

const BASE = `${import.meta.env.BASE_URL ?? '/'}`.replace(/\/$/, '');
const HERO_ART_URL = `${BASE}/ui/background-landing.png`;
const SQUARE_LOGO_URL = `${BASE}/ui/logo-transparent-square.png`;

type TitleOverlay =
  | 'none'
  | 'new-run'
  | 'shop'
  | 'achievements'
  | 'settings'
  | 'how-to-play'
  | 'credits'
  | 'stats';

interface TitleScreenProps {
  onStart: (config?: NewRunConfig) => void;
  onTour?: () => void;
}

export function TitleScreen({ onStart, onTour }: TitleScreenProps) {
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
    ...(onTour
      ? {
          onTour: () => {
            if (overlay === 'none') {
              initAudioBusSafely();
              onTour();
            }
          },
        }
      : {}),
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
  // a random phrase so each run is unique. This DOES NOT skip the modal code
  // path — it calls the exact same `onStart(cfg)` the PLAY button does.
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
    // biome-ignore lint/correctness/useExhaustiveDependencies: boot-time autoplay, fire-and-forget
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
      <CompactLayout
        orientation={formFactor.isPortrait ? 'portrait' : 'landscape'}
        tickets={tickets}
        onStart={() => setOverlay('new-run')}
        {...(onTour
          ? {
              onTour: () => {
                initAudioBusSafely();
                onTour();
              },
            }
          : {})}
        onOpen={setOverlay}
        startButtonRef={startButtonRef}
      >
        {overlays}
      </CompactLayout>
    );
  }

  // Full hero-art distributed layout (tablet, desktop, ultrawide).
  return (
    <div
      data-testid="title-screen"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        backgroundImage: `url(${HERO_ART_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: color.night,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.45) 100%)',
          pointerEvents: 'none',
        }}
      />

      <nav
        aria-label="Info menu"
        style={{
          position: 'absolute',
          top: `calc(${space.md}px + env(safe-area-inset-top, 0px))`,
          left: `calc(${space.md}px + env(safe-area-inset-left, 0px))`,
          display: 'flex',
          flexDirection: 'column',
          gap: space.xs,
          zIndex: 2,
          maxWidth: '30vw',
        }}
      >
        <BrandButton
          kind="balloon"
          hue="blue"
          size="sm"
          onClick={() => setOverlay('how-to-play')}
          testId="how-to-play-button"
        >
          ❓ HOW TO PLAY
        </BrandButton>
        <BrandButton
          kind="balloon"
          hue="purple"
          size="sm"
          onClick={() => setOverlay('stats')}
          testId="stats-button"
        >
          📊 STATS
        </BrandButton>
        <BrandButton
          kind="balloon"
          hue="orange"
          size="sm"
          onClick={() => setOverlay('credits')}
          testId="credits-button"
        >
          🎭 CREDITS
        </BrandButton>
      </nav>

      <div
        style={{
          position: 'absolute',
          top: `calc(${space.md}px + env(safe-area-inset-top, 0px))`,
          right: `calc(${space.md}px + env(safe-area-inset-right, 0px))`,
          zIndex: 2,
          maxWidth: '40vw',
        }}
      >
        <Leaderboard />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: `calc(48% + env(safe-area-inset-bottom, 0px))`,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <TicketPill tickets={tickets} />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: `calc(${space.xl}px + env(safe-area-inset-bottom, 0px))`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: space.md,
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: space.md,
            justifyContent: 'center',
            flexWrap: 'wrap',
            maxWidth: '92vw',
          }}
        >
          <BrandButton
            ref={startButtonRef}
            kind="primary"
            size="lg"
            onClick={() => setOverlay('new-run')}
            testId="start-button"
          >
            NEW RUN
          </BrandButton>
          {onTour && (
            <BrandButton
              kind="balloon"
              hue="blue"
              size="lg"
              onClick={() => {
                initAudioBusSafely();
                onTour();
              }}
              testId="tour-button"
            >
              VISIT THE MIDWAY
            </BrandButton>
          )}
          <BrandButton
            kind="balloon"
            hue="yellow"
            size="lg"
            onClick={() => setOverlay('shop')}
            testId="shop-button"
          >
            🎟 SHOP
          </BrandButton>
          <BrandButton
            kind="balloon"
            hue="purple"
            size="lg"
            onClick={() => setOverlay('achievements')}
            testId="achievements-button"
          >
            🏆 ACHIEVEMENTS
          </BrandButton>
          <BrandButton
            kind="balloon"
            hue="green"
            size="lg"
            onClick={() => setOverlay('settings')}
            testId="settings-button"
          >
            ⚙ SETTINGS
          </BrandButton>
        </div>
      </div>

      {overlays}
    </div>
  );
}

function TicketPill({ tickets }: { tickets: number }) {
  return (
    <div
      style={{
        ...typeStyle(ui.body),
        color: color.yellow,
        fontSize: '1rem',
        background: 'rgba(0,0,0,0.55)',
        padding: `${space.xs}px ${space.md}px`,
        borderRadius: 999,
        border: `2px solid ${color.yellow}`,
        letterSpacing: '0.12em',
        textShadow: `2px 2px 0 ${color.red}`,
      }}
      data-testid="title-ticket-balance"
    >
      🎟 {tickets} TICKETS
    </div>
  );
}

interface CompactProps {
  orientation: 'portrait' | 'landscape';
  tickets: number;
  onStart: () => void;
  onTour?: () => void;
  onOpen: (o: TitleOverlay) => void;
  startButtonRef: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
}

/**
 * Compact phone layout — square logo + stacked buttons, no hero-art crop.
 * Portrait: logo top, buttons stacked vertically.
 * Landscape: logo left, buttons column right (so thumbs reach both).
 */
function CompactLayout({
  orientation,
  tickets,
  onStart,
  onTour,
  onOpen,
  startButtonRef,
  children,
}: CompactProps) {
  const isLandscape = orientation === 'landscape';

  return (
    <div
      data-testid="title-screen"
      data-layout={`compact-${orientation}`}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'auto',
        background: `radial-gradient(ellipse at top, #1a1230 0%, ${color.night} 60%, #000 100%)`,
        display: 'flex',
        flexDirection: isLandscape ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `calc(${space.md}px + env(safe-area-inset-top, 0px)) ${space.md}px calc(${space.md}px + env(safe-area-inset-bottom, 0px)) ${space.md}px`,
        gap: isLandscape ? space.lg : space.md,
      }}
    >
      {/* Logo — square transparent PNG, scales with min-dim */}
      <img
        src={SQUARE_LOGO_URL}
        alt="Midway Mayhem — Clown Car Chaos"
        data-testid="title-square-logo"
        style={{
          width: isLandscape ? 'min(40vw, 45vh)' : 'min(80vw, 50vh)',
          maxWidth: 360,
          height: 'auto',
          flexShrink: 0,
          filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.55))',
        }}
      />

      {/* Button column */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: space.sm,
          width: isLandscape ? 'min(50vw, 360px)' : 'min(90vw, 360px)',
        }}
      >
        <TicketPill tickets={tickets} />

        <BrandButton
          ref={startButtonRef}
          kind="primary"
          size="lg"
          onClick={onStart}
          testId="start-button"
        >
          NEW RUN
        </BrandButton>
        {onTour && (
          <BrandButton kind="balloon" hue="blue" size="md" onClick={onTour} testId="tour-button">
            VISIT THE MIDWAY
          </BrandButton>
        )}
        <BrandButton
          kind="balloon"
          hue="yellow"
          size="md"
          onClick={() => onOpen('shop')}
          testId="shop-button"
        >
          🎟 SHOP
        </BrandButton>
        <BrandButton
          kind="balloon"
          hue="purple"
          size="md"
          onClick={() => onOpen('achievements')}
          testId="achievements-button"
        >
          🏆 ACHIEVEMENTS
        </BrandButton>
        <BrandButton
          kind="balloon"
          hue="blue"
          size="md"
          onClick={() => onOpen('how-to-play')}
          testId="how-to-play-button"
        >
          ❓ HOW TO PLAY
        </BrandButton>
        <BrandButton
          kind="balloon"
          hue="orange"
          size="sm"
          onClick={() => onOpen('stats')}
          testId="stats-button"
        >
          📊 STATS
        </BrandButton>
        <BrandButton
          kind="balloon"
          hue="orange"
          size="sm"
          onClick={() => onOpen('credits')}
          testId="credits-button"
        >
          🎭 CREDITS
        </BrandButton>
        <BrandButton
          kind="balloon"
          hue="green"
          size="sm"
          onClick={() => onOpen('settings')}
          testId="settings-button"
        >
          ⚙ SETTINGS
        </BrandButton>
      </div>

      {children}
    </div>
  );
}
