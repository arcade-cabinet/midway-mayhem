/**
 * @module hud/TitleHeroLayout
 *
 * Full hero-art distributed layout for TitleScreen.
 * Used on tablet, desktop, and ultrawide.
 * Background: background-landing.png (hero art) with vignette overlay.
 * Buttons distributed: info nav top-left, leaderboard top-right,
 * ticket pill above action row, action row pinned bottom-center.
 *
 * Extracted from TitleScreen.tsx to keep that file under 300 LOC.
 */

import type React from 'react';
import { BrandButton } from '@/design/components/BrandButton';
import { color, space } from '@/design/tokens';
import { Leaderboard } from './Leaderboard';
import type { TitleOverlay } from './TitleCompactLayout';
import { TicketPill } from './TitleCompactLayout';

const BASE = `${import.meta.env.BASE_URL ?? '/'}`.replace(/\/$/, '');
const HERO_ART_URL = `${BASE}/ui/background-landing.png`;

interface HeroProps {
  tickets: number;
  onStart: () => void;
  onTour?: () => void;
  onOpen: (o: TitleOverlay) => void;
  startButtonRef: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
}

export function TitleHeroLayout({
  tickets,
  onStart,
  onTour,
  onOpen,
  startButtonRef,
  children,
}: HeroProps) {
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
          onClick={() => onOpen('how-to-play')}
          testId="how-to-play-button"
        >
          ❓ HOW TO PLAY
        </BrandButton>
        <BrandButton
          kind="balloon"
          hue="purple"
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
            onClick={onStart}
            testId="start-button"
          >
            NEW RUN
          </BrandButton>
          {onTour && (
            <BrandButton kind="balloon" hue="blue" size="lg" onClick={onTour} testId="tour-button">
              VISIT THE MIDWAY
            </BrandButton>
          )}
          <BrandButton
            kind="balloon"
            hue="yellow"
            size="lg"
            onClick={() => onOpen('shop')}
            testId="shop-button"
          >
            🎟 SHOP
          </BrandButton>
          <BrandButton
            kind="balloon"
            hue="purple"
            size="lg"
            onClick={() => onOpen('achievements')}
            testId="achievements-button"
          >
            🏆 ACHIEVEMENTS
          </BrandButton>
          <BrandButton
            kind="balloon"
            hue="green"
            size="lg"
            onClick={() => onOpen('settings')}
            testId="settings-button"
          >
            ⚙ SETTINGS
          </BrandButton>
        </div>
      </div>

      {children}
    </div>
  );
}
