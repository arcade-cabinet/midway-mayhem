/**
 * Ambient declaration that extends `@vitest/browser/context` with our
 * custom `writePngFromDataUrl` server command. Defined once here so every
 * test file can call `commands.writePngFromDataUrl(...)` without repeating
 * the `declare module` block.
 *
 * Implementation: scripts/vitest-write-png-command.ts
 * Wiring: vite.config.ts `commands: { writePngFromDataUrl }`
 *
 * This file intentionally has NO top-level imports/exports — it stays a
 * *script* file (not a module) so the `declare module` augmentation
 * applies globally wherever tsconfig includes this .d.ts.
 */

declare module '@vitest/browser/context' {
  interface BrowserCommands {
    writePngFromDataUrl(
      dataUrl: string,
      relPath: string,
    ): Promise<{ path: string; bytes: number }>;
  }
}
