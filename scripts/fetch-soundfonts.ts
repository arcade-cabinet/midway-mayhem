import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Fetch soundfonts into public/soundfonts/.
 *
 * The SF2 files are too large (>30MB) to commit; gitignored. This script
 * pulls the CC-clean defaults so developers don't have to hunt down URLs.
 *
 * Usage: pnpm tsx scripts/fetch-soundfonts.ts
 */

const OUT = join(process.cwd(), 'public', 'soundfonts');

const SOURCES: { name: string; url: string }[] = [
  {
    name: 'GeneralUser-GS.sf2',
    url: 'https://github.com/mrbumpy409/GeneralUser-GS/raw/main/GeneralUser-GS.sf2',
  },
];

async function fetchOne(name: string, url: string): Promise<void> {
  const outPath = join(OUT, name);
  if (existsSync(outPath)) {
    return;
  }
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) {
    throw new Error(`[fetch] ${name}: ${resp.status} ${resp.statusText}`);
  }
  const bytes = new Uint8Array(await resp.arrayBuffer());
  writeFileSync(outPath, bytes);
}

async function main(): Promise<void> {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  for (const s of SOURCES) {
    await fetchOne(s.name, s.url);
  }
}

void main();
