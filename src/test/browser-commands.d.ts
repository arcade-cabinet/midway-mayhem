/**
 * Ambient declarations shared across all vitest-browser tests:
 *
 * 1. Extends `@vitest/browser/context` with our custom `writePngFromDataUrl`
 *    server command. Implementation: scripts/vitest-write-png-command.ts.
 *    Wiring: vite.config.ts `commands: { writePngFromDataUrl }`.
 *
 * 2. The `window.__mm` debug handle installed by diagnosticsBus on every
 *    boot (DEV, preview, production). Integration tests read from .diag()
 *    and drive run lifecycle via .start() / .end().
 *
 * `export {}` at the bottom turns this file into a module so that
 * `declare module` augmentations MERGE into the existing exports from
 * `@vitest/browser/context` rather than replacing them. The `Window`
 * augmentation is wrapped in `declare global` so it still affects the
 * global scope when read from a module file.
 */

// BrowserCommands is defined in `vitest/internal/browser` and re-used by
// `@vitest/browser/context`, so augment the source module.
declare module 'vitest/internal/browser' {
  interface BrowserCommands {
    writePngFromDataUrl(dataUrl: string, relPath: string): Promise<{ path: string; bytes: number }>;
  }
}

declare global {
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
      enumerateMeshes?: () => Array<Record<string, unknown>>;
      dumpScene?: (maxDepth?: number) => Record<string, unknown>;
      dumpObstacles?: () => Array<Record<string, number | string | boolean>>;
    };
  }
}

export {};
