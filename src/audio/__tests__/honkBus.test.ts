/**
 * honkBus unit tests — horn dispatch + cooldown + subscriber fan-out.
 * Uses vi.resetModules per test so the module-local singletons
 * (lastHonkAt, handlers[], _hornSlug) start fresh.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const playHonkMock = vi.fn();
const reportErrorMock = vi.fn();

vi.mock('@/audio/audioBus', () => ({
  audioBus: {
    playHonk: (...args: unknown[]) => playHonkMock(...args),
  },
}));

vi.mock('@/game/errorBus', () => ({
  reportError: (...args: unknown[]) => reportErrorMock(...args),
}));

// HONK.COOLDOWN_S = 2s. We manipulate performance.now() to jump past cooldown.
let nowValue = 0;
beforeEach(() => {
  vi.resetModules();
  playHonkMock.mockReset();
  reportErrorMock.mockReset();
  nowValue = 10_000;
  vi.spyOn(performance, 'now').mockImplementation(() => nowValue);
});

async function load() {
  return await import('@/audio/honkBus');
}

describe('honk()', () => {
  it('fires and returns true on first call', async () => {
    const { honk } = await load();
    expect(honk()).toBe(true);
    expect(playHonkMock).toHaveBeenCalledTimes(1);
  });

  it('defaults to the classic-beep path (no slug argument)', async () => {
    const { honk } = await load();
    honk();
    expect(playHonkMock).toHaveBeenCalledWith();
  });

  it('returns false and skips playback while within cooldown window', async () => {
    const { honk } = await load();
    expect(honk()).toBe(true);
    nowValue += 500; // < 2000ms
    expect(honk()).toBe(false);
    expect(playHonkMock).toHaveBeenCalledTimes(1);
  });

  it('fires again once cooldown (2s) has elapsed', async () => {
    const { honk } = await load();
    honk();
    nowValue += 2_001;
    expect(honk()).toBe(true);
    expect(playHonkMock).toHaveBeenCalledTimes(2);
  });
});

describe('setHornSlug() + slug routing', () => {
  it.each([
    ['circus-fanfare', 'circus-fanfare'],
    ['slide-whistle', 'slide-whistle'],
    ['air-horn', 'air-horn'],
  ])('routes slug %s → audioBus.playHonk(%s)', async (slug, expected) => {
    const { honk, setHornSlug } = await load();
    setHornSlug(slug);
    honk();
    expect(playHonkMock).toHaveBeenCalledWith(expected);
  });

  it('routes classic-beep through the no-argument path', async () => {
    const { honk, setHornSlug } = await load();
    setHornSlug('classic-beep');
    honk();
    expect(playHonkMock).toHaveBeenCalledWith();
  });

  it('falls back to no-argument playHonk for unknown slugs', async () => {
    const { honk, setHornSlug } = await load();
    setHornSlug('brand-new-weird-one');
    honk();
    expect(playHonkMock).toHaveBeenCalledWith();
  });
});

describe('onHonk subscribers', () => {
  it('invokes all registered handlers exactly once per honk', async () => {
    const { honk, onHonk } = await load();
    const a = vi.fn();
    const b = vi.fn();
    onHonk(a);
    onHonk(b);
    honk();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe function removes the handler', async () => {
    const { honk, onHonk } = await load();
    const h = vi.fn();
    const unsub = onHonk(h);
    honk();
    unsub();
    nowValue += 2_001;
    honk();
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('does not call handlers when cooldown blocks the honk', async () => {
    const { honk, onHonk } = await load();
    const h = vi.fn();
    onHonk(h);
    honk(); // fires
    honk(); // blocked
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('a throwing handler reports but does not prevent other handlers from running', async () => {
    const { honk, onHonk } = await load();
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    onHonk(bad);
    onHonk(good);
    honk();
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
    expect(reportErrorMock).toHaveBeenCalledTimes(1);
    expect(reportErrorMock.mock.calls[0]?.[1]).toMatch(/handler threw/);
  });
});

describe('playHornForSlug failure path', () => {
  it('reports and rethrows when audioBus.playHonk throws', async () => {
    playHonkMock.mockImplementation(() => {
      throw new Error('tone not initialised');
    });
    const { honk } = await load();
    expect(() => honk()).toThrow(/tone not initialised/);
    expect(reportErrorMock).toHaveBeenCalledTimes(1);
    expect(reportErrorMock.mock.calls[0]?.[1]).toMatch(/playHornForSlug failed/);
  });
});
