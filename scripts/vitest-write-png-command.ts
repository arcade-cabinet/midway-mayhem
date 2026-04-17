/**
 * Custom vitest browser command that receives a base64-encoded PNG data URL
 * from a browser test and writes the decoded PNG bytes to a path on the host
 * filesystem. This is the bridge we use to get WebGL canvas.toDataURL()
 * bytes out of the browser and onto disk at their true backing-buffer
 * resolution — not the CSS/iframe display size that a DOM screenshot would
 * capture.
 *
 * Usage from a browser test:
 *   import { commands } from '@vitest/browser/context';
 *   const dataUrl = canvas.toDataURL('image/png');
 *   await commands.writePngFromDataUrl(dataUrl, '.test-screenshots/thing.png');
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { BrowserCommand } from 'vitest/node';

const PNG_PREFIX = 'data:image/png;base64,';

export const writePngFromDataUrl: BrowserCommand<[string, string]> = async (
  ctx,
  dataUrl,
  relPath,
) => {
  if (!dataUrl.startsWith(PNG_PREFIX)) {
    throw new Error(
      `writePngFromDataUrl: expected PNG data URL, got ${dataUrl.slice(0, 32)}…`,
    );
  }
  const bytes = Buffer.from(dataUrl.slice(PNG_PREFIX.length), 'base64');
  const projectRoot = ctx.project.config.root;
  const outPath = isAbsolute(relPath) ? relPath : resolve(projectRoot, relPath);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, bytes);
  return { path: outPath, bytes: bytes.length };
};
