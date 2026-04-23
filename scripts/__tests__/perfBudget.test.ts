/**
 * perfBudget.test.ts — unit tests for the gzip-size helper in audit-perf.ts
 *
 * Verifies the helper handles edge-case inputs (empty file, single-byte
 * file) without throwing, and that measured sizes are non-negative.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gzipSize } from '../audit-perf';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'perf-budget-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('gzipSize', () => {
  it('handles an empty file without throwing', async () => {
    const path = join(dir, 'empty.js');
    await writeFile(path, '');
    const size = await gzipSize(path);
    // An empty gzip stream still has header+trailer overhead (~20 bytes)
    expect(size).toBeGreaterThanOrEqual(0);
  });

  it('handles a single-byte file without throwing', async () => {
    const path = join(dir, 'single.js');
    await writeFile(path, 'x');
    const size = await gzipSize(path);
    expect(size).toBeGreaterThan(0);
  });

  it('compressed size is smaller than raw size for repetitive content', async () => {
    const path = join(dir, 'repetitive.js');
    // Highly repetitive content compresses very well
    await writeFile(path, 'console.log("hello");'.repeat(500));
    const raw = Buffer.from('console.log("hello");'.repeat(500)).length;
    const compressed = await gzipSize(path);
    expect(compressed).toBeLessThan(raw);
  });

  it('returns a number (not NaN) for a normal JS-like file', async () => {
    const path = join(dir, 'normal.js');
    await writeFile(path, '(function(){"use strict";var x=1+2;return x;})();');
    const size = await gzipSize(path);
    expect(typeof size).toBe('number');
    expect(Number.isNaN(size)).toBe(false);
    expect(size).toBeGreaterThan(0);
  });

  it('rejects with an error when the file does not exist', async () => {
    await expect(gzipSize(join(dir, 'nonexistent.js'))).rejects.toThrow();
  });
});
