/**
 * buses unit tests — audio bus factory. Tone.js is mocked so we can
 * verify the graph shape without a real AudioContext.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted spies — each call returns a chainable fake node.
const { volumeCtor, compressorCtor, channelCtor, meterCtor, connectSpy } = vi.hoisted(() => ({
  volumeCtor: vi.fn(),
  compressorCtor: vi.fn(),
  channelCtor: vi.fn(),
  meterCtor: vi.fn(),
  connectSpy: vi.fn(),
}));

vi.mock('tone', () => {
  class FakeNode {
    volume = { value: 0, rampTo: vi.fn() };
    connect(_other: unknown) {
      connectSpy(_other);
      return this;
    }
    toDestination() {
      return this;
    }
    getValue() {
      return -60;
    }
  }
  class Volume extends FakeNode {
    constructor(db: number) {
      super();
      volumeCtor(db);
      this.volume.value = db;
    }
  }
  class Compressor extends FakeNode {
    constructor(threshold: number, ratio: number) {
      super();
      compressorCtor(threshold, ratio);
    }
  }
  class Channel extends FakeNode {
    constructor(opts: { volume: number }) {
      super();
      channelCtor(opts);
      this.volume.value = opts.volume;
    }
  }
  class Meter extends FakeNode {
    constructor(smoothing: number) {
      super();
      meterCtor(smoothing);
    }
  }
  return { Volume, Compressor, Channel, Meter };
});

beforeEach(() => {
  vi.resetModules();
  volumeCtor.mockClear();
  compressorCtor.mockClear();
  channelCtor.mockClear();
  meterCtor.mockClear();
  connectSpy.mockClear();
});

afterEach(async () => {
  const { stopDuckingLoop } = await import('@/audio/buses');
  stopDuckingLoop();
});

async function freshModule() {
  return await import('@/audio/buses');
}

describe('getBuses', () => {
  it('throws before initBuses', async () => {
    const { getBuses } = await freshModule();
    expect(() => getBuses()).toThrow(/not initialized/);
  });
});

describe('initBuses', () => {
  it('constructs master volume, compressor, 3 channels, and meter', async () => {
    const { initBuses } = await freshModule();
    initBuses();
    expect(volumeCtor).toHaveBeenCalledWith(-6);
    expect(compressorCtor).toHaveBeenCalledWith(-18, 4);
    // musicBus / sfxBus / ambBus
    expect(channelCtor).toHaveBeenCalledTimes(3);
    expect(channelCtor).toHaveBeenCalledWith({ volume: -6 });
    expect(channelCtor).toHaveBeenCalledWith({ volume: -3 });
    expect(channelCtor).toHaveBeenCalledWith({ volume: -14 });
    expect(meterCtor).toHaveBeenCalledWith(0.7);
  });

  it('returns a Buses record with all five fields', async () => {
    const { initBuses } = await freshModule();
    const b = initBuses();
    expect(b.master).toBeDefined();
    expect(b.musicBus).toBeDefined();
    expect(b.sfxBus).toBeDefined();
    expect(b.ambBus).toBeDefined();
    expect(b.sfxMeter).toBeDefined();
  });

  it('is idempotent — repeated calls reuse the same Buses instance', async () => {
    const { initBuses } = await freshModule();
    const a = initBuses();
    const b = initBuses();
    expect(b).toBe(a);
    // Ctors not called again
    expect(channelCtor).toHaveBeenCalledTimes(3);
  });

  it('getBuses returns the same instance after init', async () => {
    const { initBuses, getBuses } = await freshModule();
    const a = initBuses();
    expect(getBuses()).toBe(a);
  });
});

describe('stopDuckingLoop', () => {
  it('is safe to call when no loop has started', async () => {
    const { stopDuckingLoop } = await freshModule();
    expect(() => stopDuckingLoop()).not.toThrow();
  });

  it('is safe to call before initBuses', async () => {
    const { stopDuckingLoop } = await freshModule();
    expect(() => stopDuckingLoop()).not.toThrow();
  });
});
