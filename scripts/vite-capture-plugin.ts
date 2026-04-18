/**
 * Dev-only Vite plugin: POST /__capture endpoint receives debug capture
 * payloads from the game and writes them to
 * `.capture/<ISO timestamp>/{frame.png, state.json}` in the repo root.
 *
 * Activated only in `serve` (dev) mode. In production build it's absent
 * and the browser-side capture code falls back to a no-op.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin } from 'vite';

interface CaptureRequest {
  capturedAt: string;
  label: string | null;
  frameDataUrl: string;
  [k: string]: unknown;
}

function sanitizeFolder(iso: string, label: string | null): string {
  const ts = iso.replace(/[:]/g, '-');
  if (!label) return ts;
  const safe = label.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 48);
  return safe ? `${ts}__${safe}` : ts;
}

export function captureServerPlugin(opts: { captureDir?: string } = {}): Plugin {
  const baseDir = opts.captureDir ?? '.capture';
  return {
    name: 'midway-mayhem-capture',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__capture', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        const bodyText = Buffer.concat(chunks).toString('utf8');
        let payload: CaptureRequest;
        try {
          payload = JSON.parse(bodyText) as CaptureRequest;
        } catch (err) {
          res.statusCode = 400;
          res.setHeader('content-type', 'application/json');
          res.end(
            JSON.stringify({
              ok: false,
              error: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
            }),
          );
          return;
        }

        const folder = sanitizeFolder(payload.capturedAt, payload.label);
        const dir = join(process.cwd(), baseDir, folder);
        await mkdir(dir, { recursive: true });

        const match = /^data:image\/png;base64,(.+)$/.exec(payload.frameDataUrl);
        if (!match) {
          res.statusCode = 400;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: 'frameDataUrl missing or malformed' }));
          return;
        }
        const pngBytes = Buffer.from(match[1] as string, 'base64');
        await writeFile(join(dir, 'frame.png'), pngBytes);

        const { frameDataUrl: _drop, ...rest } = payload;
        void _drop;
        await writeFile(join(dir, 'state.json'), JSON.stringify(rest, null, 2), 'utf8');

        const relPath = `${baseDir}/${folder}`;
        console.log(`[capture] ${relPath}/  (frame.png + state.json)`);
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: true, path: relPath }));
      });
    },
  };
}
