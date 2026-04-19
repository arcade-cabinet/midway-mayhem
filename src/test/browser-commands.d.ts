/**
 * Ambient declarations shared across all vitest-browser tests:
 *
 * 1. Extends `vitest/browser` with our custom `writePngFromDataUrl`
 *    server command. Implementation: scripts/vitest-write-png-command.ts.
 *    Wiring: vite.config.ts `commands: { writePngFromDataUrl }`.
 *
 * 2. The `window.__mm` debug handle installed by diagnosticsBus on every
 *    boot (DEV, preview, production). Integration tests read from .diag()
 *    and drive run lifecycle via .start() / .end().
 *
 * This file intentionally has NO top-level imports/exports — it stays a
 * *script* file (not a module) so the `declare` augmentations apply
 * globally wherever tsconfig includes this .d.ts.
 */

declare module 'vitest/browser' {
  interface BrowserCommands {
    writePngFromDataUrl(dataUrl: string, relPath: string): Promise<{ path: string; bytes: number }>;
  }
}

interface Window {
  __mm?: {
    diag?: () => import('@/game/diagnosticsBus').DiagnosticsDump;
    setSteer?: (v: number) => void;
    start?: () => void;
    end?: () => void;
    crash?: (heavy?: boolean) => void;
    pickup?: (kind: 'ticket' | 'boost' | 'mega') => void;
    pause?: () => void;
    resume?: () => void;
    comboEvent?: (kind: 'scare' | 'pickup' | 'near-miss') => void;
  };
}
