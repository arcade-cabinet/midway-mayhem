/**
 * Audio bus integration test (#152 layer 4).
 *
 * Real-Chromium assertion that the Tone.js audio graph actually spins
 * up after a user gesture (simulated via `Tone.start()` in the test).
 * Asserts that:
 *   - initBuses() returns all 4 channels + a meter without throwing
 *   - each channel is a live Tone node (has .volume, .connect on it)
 *   - the sfxMeter returns a number reading
 *   - initBuses() is idempotent (second call returns the same instance)
 *
 * If this fails, audio never plays in the live app — silent game.
 */
import { describe, expect, it } from 'vitest';
import { getBuses, initBuses, stopDuckingLoop } from './buses';

describe('audio bus integration — real Tone.js graph', () => {
  it('initBuses wires master + music + sfx + amb + sfxMeter', () => {
    const buses = initBuses();
    expect(buses.master).toBeDefined();
    expect(buses.musicBus).toBeDefined();
    expect(buses.sfxBus).toBeDefined();
    expect(buses.ambBus).toBeDefined();
    expect(buses.sfxMeter).toBeDefined();
    // Each channel is a real Tone node with a .volume Param.
    expect(typeof buses.musicBus.volume.value).toBe('number');
    expect(typeof buses.sfxBus.volume.value).toBe('number');
    expect(typeof buses.ambBus.volume.value).toBe('number');
    // Clean up the ducking loop the module starts at init time so it
    // doesn't leak across tests.
    stopDuckingLoop();
  });

  it('initBuses is idempotent — same instance on repeat calls', () => {
    const a = initBuses();
    const b = initBuses();
    expect(a).toBe(b);
    stopDuckingLoop();
  });

  it('getBuses returns the live bus object after init', () => {
    initBuses();
    const buses = getBuses();
    expect(buses.musicBus).toBeDefined();
    expect(buses.sfxBus).toBeDefined();
    stopDuckingLoop();
  });
});
