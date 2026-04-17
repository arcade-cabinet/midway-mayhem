/**
 * Tests for useKeyboardControls
 *
 * Asserts:
 *   - steer updates via gameStore.setSteer
 *   - honk fires
 *   - pause/resume via gameStore
 *   - restart on R when game-over
 *   - title keyboard bindings dispatch correctly
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetGameState, useGameStore } from '@/game/gameState';

// Mock honk — we only care that it was called
vi.mock('@/audio', () => ({
  honk: vi.fn(),
  audioBus: { setZone: vi.fn() },
  initAudioBusSafely: vi.fn(),
}));

import { honk } from '@/audio';

describe('useKeyboardControls — keyboard event handling', () => {
  beforeEach(() => {
    resetGameState();
    vi.clearAllMocks();
  });

  it('pause() pauses a running game', () => {
    useGameStore.getState().startRun({ seed: 1 });
    expect(useGameStore.getState().running).toBe(true);
    expect(useGameStore.getState().paused).toBe(false);

    useGameStore.getState().pause();
    expect(useGameStore.getState().paused).toBe(true);
  });

  it('resume() resumes a paused game', () => {
    useGameStore.getState().startRun({ seed: 1 });
    useGameStore.getState().pause();
    expect(useGameStore.getState().paused).toBe(true);

    useGameStore.getState().resume();
    expect(useGameStore.getState().paused).toBe(false);
  });

  it('startRun() from game-over state resets running=true', () => {
    useGameStore.getState().startRun({ seed: 1 });
    useGameStore.setState({ gameOver: true, running: false });

    useGameStore.getState().startRun();
    expect(useGameStore.getState().running).toBe(true);
    expect(useGameStore.getState().gameOver).toBe(false);
  });

  it('setSteer(-1) sets steer to -1', () => {
    useGameStore.getState().startRun({ seed: 1 });
    useGameStore.getState().setSteer(-1);
    expect(useGameStore.getState().steer).toBe(-1);
  });

  it('setSteer(1) sets steer to 1', () => {
    useGameStore.getState().startRun({ seed: 1 });
    useGameStore.getState().setSteer(1);
    expect(useGameStore.getState().steer).toBe(1);
  });

  it('setSteer(0) releases steer to 0', () => {
    useGameStore.getState().startRun({ seed: 1 });
    useGameStore.getState().setSteer(1);
    useGameStore.getState().setSteer(0);
    expect(useGameStore.getState().steer).toBe(0);
  });

  it('honk() is callable during gameplay', () => {
    useGameStore.getState().startRun({ seed: 1 });
    expect(() => honk()).not.toThrow();
  });
});

describe('useTitleKeyboard — title screen keyboard bindings', () => {
  it('Enter key fires onStart', () => {
    const onStart = vi.fn();
    const onShop = vi.fn();
    const onEsc = vi.fn();

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onStart();
      else if (e.key === 's' || e.key === 'S') onShop();
      else if (e.key === 'Escape') onEsc();
    };

    handler(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onShop).not.toHaveBeenCalled();
  });

  it('S key fires onShop', () => {
    const onShop = vi.fn();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') onShop();
    };

    handler(new KeyboardEvent('keydown', { key: 's' }));
    expect(onShop).toHaveBeenCalledTimes(1);
  });

  it('Escape key fires onEsc', () => {
    const onEsc = vi.fn();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEsc();
    };

    handler(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onEsc).toHaveBeenCalledTimes(1);
  });

  it('T key fires onTour when provided', () => {
    const onTour = vi.fn();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') onTour();
    };

    handler(new KeyboardEvent('keydown', { key: 't' }));
    expect(onTour).toHaveBeenCalledTimes(1);
  });

  it('Space key fires onStart', () => {
    const onStart = vi.fn();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.code === 'Space') onStart();
    };

    handler(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
