/**
 * preferences unit tests — in-memory fallback path (Node, no Capacitor,
 * no OPFS). Covers string/JSON/bool round-trips, key namespacing, remove,
 * and clearPrefsForTests.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPrefsForTests,
  PREF_KEYS,
  prefGetBool,
  prefGetJSON,
  prefGetString,
  prefRemove,
  prefSetBool,
  prefSetJSON,
  prefSetString,
} from '@/persistence/preferences';

beforeEach(() => {
  clearPrefsForTests();
});

describe('prefSetString / prefGetString', () => {
  it('returns null for an unset key', async () => {
    expect(await prefGetString('nonexistent')).toBeNull();
  });

  it('round-trips a string', async () => {
    await prefSetString('greeting', 'hello');
    expect(await prefGetString('greeting')).toBe('hello');
  });

  it('overwrites a previous value', async () => {
    await prefSetString('x', 'a');
    await prefSetString('x', 'b');
    expect(await prefGetString('x')).toBe('b');
  });

  it('stores empty strings as empty, not null', async () => {
    await prefSetString('empty', '');
    expect(await prefGetString('empty')).toBe('');
  });
});

describe('prefSetJSON / prefGetJSON', () => {
  it('returns null for an unset key', async () => {
    expect(await prefGetJSON<{ a: number }>('missing')).toBeNull();
  });

  it('round-trips a plain object', async () => {
    await prefSetJSON('profile', { name: 'jon', level: 7 });
    expect(await prefGetJSON<{ name: string; level: number }>('profile')).toEqual({
      name: 'jon',
      level: 7,
    });
  });

  it('round-trips nested arrays', async () => {
    const payload = { scores: [1, 2, 3], tiers: { red: 'hot' } };
    await prefSetJSON('complex', payload);
    expect(await prefGetJSON('complex')).toEqual(payload);
  });

  it('returns null when stored value is not valid JSON', async () => {
    await prefSetString('broken', '{not-json');
    expect(await prefGetJSON('broken')).toBeNull();
  });
});

describe('prefSetBool / prefGetBool', () => {
  it('returns defaultValue when unset (defaults false)', async () => {
    expect(await prefGetBool('unset')).toBe(false);
    expect(await prefGetBool('unset', true)).toBe(true);
  });

  it('round-trips true', async () => {
    await prefSetBool('flag', true);
    expect(await prefGetBool('flag')).toBe(true);
  });

  it('round-trips false', async () => {
    await prefSetBool('flag', false);
    expect(await prefGetBool('flag')).toBe(false);
  });

  it('stored value is "1" for true, "0" for false (legacy-compatible)', async () => {
    await prefSetBool('t', true);
    expect(await prefGetString('t')).toBe('1');
    await prefSetBool('f', false);
    expect(await prefGetString('f')).toBe('0');
  });

  it('treats any non-"1" as false', async () => {
    await prefSetString('weird', 'yes');
    expect(await prefGetBool('weird')).toBe(false);
  });
});

describe('prefRemove', () => {
  it('removes a previously set key', async () => {
    await prefSetString('goodbye', 'hello');
    await prefRemove('goodbye');
    expect(await prefGetString('goodbye')).toBeNull();
  });

  it('is a no-op for missing keys', async () => {
    await expect(prefRemove('ghost')).resolves.toBeUndefined();
  });
});

describe('clearPrefsForTests', () => {
  it('wipes all in-memory values', async () => {
    await prefSetString('a', '1');
    await prefSetString('b', '2');
    clearPrefsForTests();
    expect(await prefGetString('a')).toBeNull();
    expect(await prefGetString('b')).toBeNull();
  });
});

describe('PREF_KEYS constants', () => {
  it('all predefined keys are non-empty strings', () => {
    for (const k of Object.values(PREF_KEYS)) {
      expect(typeof k).toBe('string');
      expect(k.length).toBeGreaterThan(0);
    }
  });

  it('keys are usable as prefSetString/prefGetString keys', async () => {
    await prefSetString(PREF_KEYS.AUDIO_ENABLED, '1');
    expect(await prefGetString(PREF_KEYS.AUDIO_ENABLED)).toBe('1');
  });

  it('keys are unique', () => {
    const vals = Object.values(PREF_KEYS);
    expect(new Set(vals).size).toBe(vals.length);
  });
});

describe('key isolation', () => {
  it('keys do not collide even with the same logical suffix', async () => {
    await prefSetString('audio', 'x');
    await prefSetString(PREF_KEYS.AUDIO_ENABLED, 'y');
    // Different keys — both persist independently
    expect(await prefGetString('audio')).toBe('x');
    expect(await prefGetString(PREF_KEYS.AUDIO_ENABLED)).toBe('y');
  });
});
