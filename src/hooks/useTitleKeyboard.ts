/**
 * Keyboard bindings for the title screen only.
 *   Enter / Space → START
 *   S             → SHOP
 *   Esc           → close open panel
 *
 * Gameplay keyboard lives in `src/input/useKeyboard.ts`.
 *
 * Key events originating from editable elements (inputs, textareas,
 * contentEditable) are ignored so typing in overlays (e.g., the seed
 * phrase field in NewRunModal) isn't hijacked by the title shortcuts.
 *
 * Callbacks are held in refs so the listener re-registers only on
 * mount/unmount; parents passing inline closures won't thrash the
 * window listener on every render.
 */

import { useEffect, useRef } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useTitleKeyboard(opts: {
  onStart: () => void;
  onShop: () => void;
  onEsc: () => void;
}): void {
  const onStartRef = useRef(opts.onStart);
  const onShopRef = useRef(opts.onShop);
  const onEscRef = useRef(opts.onEsc);

  useEffect(() => {
    onStartRef.current = opts.onStart;
    onShopRef.current = opts.onShop;
    onEscRef.current = opts.onEsc;
  }, [opts.onStart, opts.onShop, opts.onEsc]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStartRef.current();
      } else if (e.key === 's' || e.key === 'S') {
        onShopRef.current();
      } else if (e.key === 'Escape') {
        onEscRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
