import { useEffect, useState } from 'react';
import { AchievementsPanel } from './AchievementsPanel';
import { SettingsPanel } from './SettingsPanel';
import { BrandButton } from '@/design/components/BrandButton';
import { color, space } from '@/design/tokens';
import { display, typeStyle, ui } from '@/design/typography';
import { initDb } from '@/persistence/db';
import { getProfile } from '@/persistence/profile';
import { initAudioBusSafely } from '@/audio/audioBus';
import { reportError } from '@/game/errorBus';
import { Title3D } from './Title3D';
import { Leaderboard } from './Leaderboard';
import { TicketShop } from './TicketShop';

type TitleOverlay = 'none' | 'shop' | 'achievements' | 'settings';

export function TitleScreen({ onStart, onTour }: { onStart: () => void; onTour?: () => void }) {
  const [overlay, setOverlay] = useState<TitleOverlay>('none');
  const [tickets, setTickets] = useState(0);

  // Load ticket balance
  useEffect(() => {
    async function load() {
      try {
        // DB may already be initialized by App bootstrap
        await initDb();
        const p = await getProfile();
        setTickets(p.tickets);
      } catch (err) {
        reportError(err, 'TitleScreen.loadTickets');
      }
    }
    load();
  }, []);

  return (
    <div
      data-testid="title-screen"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
    >
      {/* 3D background canvas — HDRI big-top + hanging cockpit + extruded logo */}
      <Title3D />

      {/* 2D DOM overlay — brand text, START, shop, leaderboard */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          background: 'transparent',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
      <ConfettiBG />
      <div style={{ textAlign: 'center', zIndex: 2, padding: space.xxl, pointerEvents: 'auto' }}>
        <div
          style={{
            ...typeStyle(display.hero),
            color: color.yellow,
            textShadow: `6px 6px 0 ${color.red}, 12px 12px 0 ${color.blue}`,
            transform: 'skewX(-4deg)',
          }}
        >
          MIDWAY
          <br />
          MAYHEM
        </div>
        <div
          style={{
            ...typeStyle(ui.label),
            fontSize: '1.3rem',
            marginTop: space.sm,
            color: color.blue,
          }}
        >
          CLOWN CAR CHAOS
        </div>
        <div
          style={{
            ...typeStyle(ui.body),
            marginTop: space.xl,
            fontSize: '1.1rem',
            letterSpacing: '0.18em',
            color: color.white,
            opacity: 0.85,
          }}
        >
          DRIVE FAST. HONK LOUDER.
        </div>

        {/* Action buttons */}
        <div
          style={{
            marginTop: space.xxxl,
            display: 'flex',
            gap: space.lg,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <BrandButton
            kind="primary"
            size="lg"
            onClick={() => {
              initAudioBusSafely();
              onStart();
            }}
            testId="start-button"
          >
            START
          </BrandButton>
          <BrandButton
            kind="secondary"
            size="lg"
            onClick={() => setOverlay('shop')}
            testId="shop-button"
          >
            SHOP
          </BrandButton>
          <BrandButton
            kind="ghost"
            size="lg"
            onClick={() => setOverlay('achievements')}
            testId="achievements-button"
          >
            ACHIEVEMENTS
          </BrandButton>
          <BrandButton
            kind="ghost"
            size="lg"
            onClick={() => setOverlay('settings')}
            testId="settings-button"
          >
            SETTINGS
          </BrandButton>
          {onTour && (
            <BrandButton
              kind="secondary"
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
        </div>

        {/* Ticket balance */}
        <div
          style={{
            ...typeStyle(ui.body),
            marginTop: space.md,
            color: color.yellow,
            fontSize: '0.95rem',
          }}
          data-testid="title-ticket-balance"
        >
          🎟 {tickets} tickets
        </div>

        {/* Leaderboard */}
        <div style={{ marginTop: space.xxl, display: 'flex', justifyContent: 'center' }}>
          <Leaderboard />
        </div>
      </div>

      {/* Overlays */}
      {overlay === 'shop' && (
        <TicketShop
          tickets={tickets}
          onClose={() => setOverlay('none')}
          onTicketsChange={setTickets}
        />
      )}
      {overlay === 'achievements' && (
        <AchievementsPanel onClose={() => setOverlay('none')} />
      )}
      {overlay === 'settings' && (
        <SettingsPanel onClose={() => setOverlay('none')} />
      )}
      </div>{/* end DOM overlay */}
    </div>
  );
}

function ConfettiBG() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: `radial-gradient(circle at 20% 30%, ${color.red}40 0 8px, transparent 9px), radial-gradient(circle at 80% 70%, ${color.blue}40 0 8px, transparent 9px), radial-gradient(circle at 50% 50%, ${color.purple}40 0 6px, transparent 7px)`,
        backgroundSize: '80px 80px, 100px 100px, 120px 120px',
        opacity: 0.5,
      }}
    />
  );
}
