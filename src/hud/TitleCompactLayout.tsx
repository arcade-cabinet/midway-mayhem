/**
 * @module hud/TitleCompactLayout
 *
 * Compact phone layout for TitleScreen.
 * Portrait: logo top, buttons stacked vertically.
 * Landscape: logo left, buttons column right (so thumbs reach both).
 *
 * Extracted from TitleScreen.tsx to keep that file under 300 LOC.
 */
import { BrandButton } from '@/design/components/BrandButton';
import { color, space } from '@/design/tokens';
import { typeStyle, ui } from '@/design/typography';

const BASE = `${import.meta.env.BASE_URL ?? '/'}`.replace(/\/$/, '');
const SQUARE_LOGO_URL = `${BASE}/ui/logo-transparent-square.png`;

export type TitleOverlay =
  | 'none'
  | 'new-run'
  | 'shop'
  | 'achievements'
  | 'settings'
  | 'how-to-play'
  | 'credits'
  | 'stats';

export function TicketPill({ tickets }: { tickets: number }) {
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

export function TitleCompactLayout({
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

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: space.sm,
          width: isLandscape ? 'min(50vw, 360px)' : 'min(90vw, 360px)',
        }}
      >
        <TicketPill tickets={tickets} />
        <BrandButton ref={startButtonRef} kind="primary" size="lg" onClick={onStart} testId="start-button">
          NEW RUN
        </BrandButton>
        {onTour && (
          <BrandButton kind="balloon" hue="blue" size="md" onClick={onTour} testId="tour-button">
            VISIT THE MIDWAY
          </BrandButton>
        )}
        <BrandButton kind="balloon" hue="yellow" size="md" onClick={() => onOpen('shop')} testId="shop-button">
          🎟 SHOP
        </BrandButton>
        <BrandButton kind="balloon" hue="purple" size="md" onClick={() => onOpen('achievements')} testId="achievements-button">
          🏆 ACHIEVEMENTS
        </BrandButton>
        <BrandButton kind="balloon" hue="blue" size="md" onClick={() => onOpen('how-to-play')} testId="how-to-play-button">
          ❓ HOW TO PLAY
        </BrandButton>
        <BrandButton kind="balloon" hue="orange" size="sm" onClick={() => onOpen('stats')} testId="stats-button">
          📊 STATS
        </BrandButton>
        <BrandButton kind="balloon" hue="orange" size="sm" onClick={() => onOpen('credits')} testId="credits-button">
          🎭 CREDITS
        </BrandButton>
        <BrandButton kind="balloon" hue="green" size="sm" onClick={() => onOpen('settings')} testId="settings-button">
          ⚙ SETTINGS
        </BrandButton>
      </div>

      {children}
    </div>
  );
}
