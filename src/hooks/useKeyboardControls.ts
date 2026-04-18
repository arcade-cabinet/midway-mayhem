/**
 * @hook useKeyboardControls
 *
 * Keyboard bindings for the web/debug build. The shipped Capacitor build
 * is touch-only; keyboard is a developer-facing tool that never surfaces
 * to mobile users.
 *
 * Bindings (web/debug):
 *   H                → honk
 *   ArrowLeft  / A   → steer -1 (decays to 0 on keyup)
 *   ArrowRight / D   → steer +1 (decays to 0 on keyup)
 *   ArrowUp    / W   → throttle = 1 (car auto-accelerates)
 *   ArrowDown  / S   → throttle = 0 (car coasts / stops)
 *   Space            → PAUSE + CAPTURE (writes .capture/<ts>/ via /__capture)
 *   R                → restart on game-over screen
 *
 * Deliberately NO player-facing pause binding — this is a runner-style
 * arcade racer, not a pausable game. Space's pause is a debug feature
 * that co-occurs with a frame capture for bug reporting.
 */

import { useEffect } from 'react';

/**
 * Wire keyboard navigation to TitleScreen.
 *
 * Enter / Space → START
 * S → SHOP
 * Esc → close open panel
 */
export function useTitleKeyboard(opts: {
  onStart: () => void;
  onShop: () => void;
  onEsc: () => void;
}): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        opts.onStart();
      } else if (e.key === 's' || e.key === 'S') {
        opts.onShop();
      } else if (e.key === 'Escape') {
        opts.onEsc();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [opts]);
}
