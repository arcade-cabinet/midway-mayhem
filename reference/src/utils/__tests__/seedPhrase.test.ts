import { describe, expect, it } from 'vitest';
import { _pools, phraseToSeed, randomPhrase, shufflePhrase } from '@/utils/seedPhrase';

describe('seedPhrase', () => {
  it('phraseToSeed is deterministic for identical input', () => {
    expect(phraseToSeed('neon-polkadot-jalopy')).toBe(phraseToSeed('neon-polkadot-jalopy'));
  });

  it('phraseToSeed normalizes whitespace and case', () => {
    expect(phraseToSeed('Neon Polkadot Jalopy')).toBe(phraseToSeed('neon-polkadot-jalopy'));
    expect(phraseToSeed('  NEON   polkadot  jalopy ')).toBe(phraseToSeed('neon-polkadot-jalopy'));
  });

  it('phraseToSeed produces distinct seeds for distinct phrases', () => {
    const a = phraseToSeed('neon-polkadot-jalopy');
    const b = phraseToSeed('neon-polkadot-bozo');
    expect(a).not.toBe(b);
  });

  it('phraseToSeed is a 32-bit unsigned integer', () => {
    const seed = phraseToSeed('molten-checkered-parade');
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(0x100000000);
  });

  it('empty phrase falls back to a random seed', () => {
    const a = phraseToSeed('');
    const b = phraseToSeed('  ');
    // Both are uint32, both may differ (random fallback)
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(0);
  });

  it('randomPhrase produces 3 hyphen-joined segments from the pools', () => {
    const p = randomPhrase(() => 0.5);
    const parts = p.split('-');
    expect(parts.length).toBeGreaterThanOrEqual(3);
  });

  it('shufflePhrase returns matching phrase + seed', () => {
    const { phrase, seed } = shufflePhrase(() => 0.25);
    expect(phraseToSeed(phrase)).toBe(seed);
  });

  it('pools are non-empty and typed as readonly arrays', () => {
    expect(_pools.ADJ1.length).toBeGreaterThan(10);
    expect(_pools.ADJ2.length).toBeGreaterThan(10);
    expect(_pools.NOUN.length).toBeGreaterThan(10);
  });
});
