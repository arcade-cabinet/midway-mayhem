/**
 * Repo-wide guard against a specific production boot-failure class.
 *
 * Vite's `base` is `/midway-mayhem/` on web and `./` under Capacitor.
 * Any runtime code that hardcodes an absolute path to a public/ asset
 * (e.g. `/textures/...`, `/hdri/...`, `/fonts/...`, `/ui/...`, `/models/...`)
 * works in dev (base=/) but 404s at preview + prod. Missing assets throw
 * out of a React Suspense boundary → ReactErrorBoundary reports [mm:halt] →
 * the whole tree unmounts → the user sees a black canvas. See PR #277.
 *
 * Catching these at unit-test time is cheaper than a full e2e preview run.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('..', import.meta.url).pathname;

/** Public sub-directories we serve at runtime. Any hardcoded `/X/…` string
 *  matching one of these roots will 404 under the vite base. */
const PUBLIC_ROOTS = ['textures', 'hdri', 'fonts', 'ui', 'models'] as const;

/** Only scan real source files, skip test + type declaration files. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === 'test' || entry === '__mocks__') continue;
      walk(full, out);
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.test.tsx') &&
      !entry.endsWith('.browser.test.tsx') &&
      !entry.endsWith('.d.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

describe('public-asset paths must be prefixed with the vite base', () => {
  const files = walk(SRC);

  for (const root of PUBLIC_ROOTS) {
    it(`no source file hardcodes a bare "/${root}/..." string`, () => {
      const offenders: string[] = [];
      // Match ", /, `, ' followed by /<root>/ — the quote captures both the
      // opening quote and avoids paths inside comments that start mid-line.
      const pattern = new RegExp(`['"\`]\\/${root}\\/`);
      for (const file of files) {
        const src = readFileSync(file, 'utf-8');
        // Skip lines that already use import.meta.env.BASE_URL or that are
        // inside a line-comment describing a resolved path.
        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? '';
          if (!pattern.test(line)) continue;
          if (line.includes('BASE_URL')) continue;
          if (line.trim().startsWith('*')) continue; // JSDoc body line
          if (line.trim().startsWith('//')) continue; // line comment
          offenders.push(`${relative(SRC, file)}:${i + 1}: ${line.trim()}`);
        }
      }
      expect(offenders, offenders.join('\n')).toEqual([]);
    });
  }
});
