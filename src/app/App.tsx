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

type Scene = 'boot' | 'title' | 'play' | 'tour';

export function App() {
  const [scene, setScene] = useState<Scene>('boot');
  const initLoadout = useLoadoutStore((s) => s.initLoadout);

  useEffect(() => {
    installGlobalErrorHandlers();
    installDiagnosticsBus();
    initHapticsSafely();
    initDailyRouteFromUrl();

    const bootstrap = async () => {
      // DB must be up before any persistence reads
      await initDb();
      // Grant starter unlocks on first run (idempotent — INSERT OR IGNORE)
      await Promise.all(STARTER_ITEMS.map((item) => grantUnlock(item.kind, item.slug)));
      await initLoadout();
      // Hydrate tutorial flags into in-memory cache (non-blocking if it fails)
      await hydrateTutorialFlags().catch((err: unknown) =>
        reportError(err, 'App.hydrateTutorialFlags'),
      );
      // Load tunables AFTER db so systems that read db can do so
      const t = await loadTunables();
      applyLoadedTunables(t);
      await preloadAllAssets();
      const params = new URLSearchParams(window.location.search);
      // Deterministic RNG seed override for E2E visual tests: ?seed=N
      const seedParam = params.get('seed');
      if (seedParam !== null) {
        const seedNum = parseInt(seedParam, 10);
        if (!Number.isNaN(seedNum)) {
          // Expose as window.__mmSeed for downstream systems to read
          // biome-ignore lint/suspicious/noExplicitAny: test hook
          (window as any).__mmSeed = seedNum;
        }
      }
      setScene(params.get('skip') === '1' ? 'play' : 'title');
    };

    bootstrap().catch((err: unknown) => reportError(err, 'App.bootstrap'));
  }, [initLoadout]);

  return (
    <div className="mm-app" data-testid="mm-app">
      <ReactErrorBoundary context="app-root">
        <Suspense fallback={<div className="mm-loading">loading…</div>}>
          {scene === 'boot' ? (
            <div className="mm-loading">preparing the midway…</div>
          ) : scene === 'title' ? (
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
