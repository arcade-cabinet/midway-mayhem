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
