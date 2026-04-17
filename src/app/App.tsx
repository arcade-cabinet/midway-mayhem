import { Suspense, useEffect, useState } from 'react';
import { Game } from '../components/Game';
import { TitleScreen } from '../components/TitleScreen';
import { ErrorModal } from '../components/ErrorModal';
import { ReactErrorBoundary } from '../components/ReactErrorBoundary';
import { installDiagnosticsBus } from '../systems/diagnosticsBus';
import { installGlobalErrorHandlers, reportError } from '../systems/errorBus';
import { initHapticsSafely } from '../systems/hapticsBus';
import { preloadAllAssets } from '../assets/preloader';

type Scene = 'boot' | 'title' | 'play';

export function App() {
  const [scene, setScene] = useState<Scene>('boot');

  useEffect(() => {
    installGlobalErrorHandlers();
    installDiagnosticsBus();
    initHapticsSafely();
    preloadAllAssets()
      .then(() => {
        const params = new URLSearchParams(window.location.search);
        setScene(params.get('skip') === '1' ? 'play' : 'title');
      })
      .catch((err: unknown) => reportError(err, 'preloadAllAssets'));
  }, []);

  return (
    <div className="mm-app" data-testid="mm-app">
      <ReactErrorBoundary context="app-root">
        <Suspense fallback={<div className="mm-loading">loading…</div>}>
          {scene === 'boot' ? (
            <div className="mm-loading">preparing the midway…</div>
          ) : scene === 'title' ? (
            <TitleScreen onStart={() => setScene('play')} />
          ) : (
            <Game />
          )}
        </Suspense>
      </ReactErrorBoundary>
      <ErrorModal />
    </div>
  );
}
