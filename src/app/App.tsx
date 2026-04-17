import { Suspense, useEffect, useState } from 'react';
import { preloadAllAssets } from '@/assets/preloader';
import { applyLoadedTunables, loadTunables } from '@/config/index';
import { AchievementToast } from '@/hud/AchievementToast';
import { ErrorModal } from '@/hud/ErrorModal';
import { Game } from '@/game/Game';
import { ReactErrorBoundary } from '@/hud/ReactErrorBoundary';
import { TitleScreen } from '@/hud/TitleScreen';
import { BigTopTour } from '../modes/BigTopTour';
import { STARTER_ITEMS } from '@/config/shopCatalog';
import { initDailyRouteFromUrl } from '@/track/dailyRoute';
import { initDb } from '@/persistence/db';
import { grantUnlock } from '@/persistence/profile';
import { hydrateTutorialFlags } from '@/persistence/tutorial';
import { installDiagnosticsBus } from '@/game/diagnosticsBus';
import { installGlobalErrorHandlers, reportError } from '@/game/errorBus';
import { initHapticsSafely } from '@/game/hapticsBus';
import { useLoadoutStore } from '@/hooks/useLoadout';

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
              onStart={() => setScene('play')}
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
