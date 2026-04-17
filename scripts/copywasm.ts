/**
 * Copy sql.js's WASM to the two paths sql.js's `locateFile` might probe:
 * - public/sql-wasm.wasm         — dev-server root fallback
 * - public/assets/sql-wasm.wasm  — production `dist/assets/` placement
 *
 * Both paths are gitignored; this script runs on every predev / prebuild /
 * prepreview hook so the file is always fresh. The duplication is
 * intentional — sql.js's runtime locateFile resolver tries both.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const src = require.resolve('sql.js/dist/sql-wasm.wasm');

for (const dir of [join('public'), join('public', 'assets')]) {
  mkdirSync(dir, { recursive: true });
  copyFileSync(src, join(dir, 'sql-wasm.wasm'));
}

// biome-ignore lint/suspicious/noConsole: build script
console.log('sql-wasm.wasm copied to public/ and public/assets/');
