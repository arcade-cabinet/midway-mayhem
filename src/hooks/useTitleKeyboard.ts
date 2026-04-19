/**
 * Keyboard bindings for the title screen only.
 *   Enter / Space → START
 *   S             → SHOP
 *   Esc           → close open panel
 *
 * Gameplay keyboard lives in `src/input/useKeyboard.ts`.
 */

import { useEffect } from 'react';

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
