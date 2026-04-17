import { Suspense, useEffect, useState } from 'react';
import { preloadAllAssets } from '@/assets/preloader';
import { applyLoadedTunables, loadTunables } from '@/config/index';
import { STARTER_ITEMS } from '@/config/shopCatalog';
import { installDiagnosticsBus } from '@/game/diagnosticsBus';
import { installGlobalErrorHandlers, reportError } from '@/game/errorBus';
import { Game } from '@/game/Game';
import { initHapticsSafely } from '@/game/hapticsBus';
import { useLoadoutStore } from '@/hooks/useLoadout';
import { AchievementToast } from '@/hud/AchievementToast';
import { ErrorModal } from '@/hud/ErrorModal';
import { ReactErrorBoundary } from '@/hud/ReactErrorBoundary';
import { TitleScreen } from '@/hud/TitleScreen';
import { initDb } from '@/persistence/db';
import { grantUnlock } from '@/persistence/profile';
import { hydrateTutorialFlags } from '@/persistence/tutorial';
import { initDailyRouteFromUrl } from '@/track/dailyRoute';
import { BigTopTour } from '../modes/BigTopTour';

type Scene = 'title' | 'play' | 'tour';

export function App() {
  const params =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const [scene, setScene] = useState<Scene>(params?.get('skip') === '1' ? 'play' : 'title');
  const initLoadout = useLoadoutStore((s) => s.initLoadout);

  useEffect(() => {
    installGlobalErrorHandlers();
    installDiagnosticsBus();
    initHapticsSafely();
    initDailyRouteFromUrl();

    // Bootstrap runs in the background while TitleScreen is visible.
    // TitleScreen owns its own initDb() call (idempotent), so it renders
    // instantly and becomes interactive once its deps resolve.
    const bootstrap = async () => {
      await initDb();
      await Promise.all(STARTER_ITEMS.map((item) => grantUnlock(item.kind, item.slug)));
      await initLoadout();
      await hydrateTutorialFlags().catch((err: unknown) =>
        reportError(err, 'App.hydrateTutorialFlags'),
      );
      const t = await loadTunables();
      applyLoadedTunables(t);
      await preloadAllAssets();
      const seedParam = params?.get('seed');
      if (seedParam) {
        const seedNum = parseInt(seedParam, 10);
        if (!Number.isNaN(seedNum)) {
          // biome-ignore lint/suspicious/noExplicitAny: test hook
          (window as any).__mmSeed = seedNum;
        }
      }
    };

    bootstrap().catch((err: unknown) => reportError(err, 'App.bootstrap'));
  }, [initLoadout, params]);

  return (
    <div className="mm-app" data-testid="mm-app">
      <ReactErrorBoundary context="app-root">
        <Suspense fallback={<div className="mm-loading">loading…</div>}>
          {scene === 'title' ? (
            <TitleScreen
              onStart={(cfg) => {
                if (cfg) {
                  // biome-ignore lint/suspicious/noExplicitAny: window bridge to Game.tsx
                  (window as any).__mmRunConfig = cfg;
                }
                setScene('play');
              }}
              onTour={() => setScene('tour')}
            />
          ) : scene === 'tour' ? (
            <BigTopTour onExit={() => setScene('title')} />
          ) : (
            <Game />
          )}
        </Suspense>
      </ReactErrorBoundary>
      <AchievementToast />
      <ErrorModal />
    </div>
  );
}
