/**
 * useKeyboardControls.browser.test.ts
 *
 * Real-browser tests for useKeyboardControls and useTitleKeyboard.
 * Uses real window.dispatchEvent(new KeyboardEvent(...)) via userEvent
 * to exercise the actual hook's window event-listener registrations.
 *
 * The jsdom counterpart tested game store methods directly (not the hook).
 * These tests mount the hook in a minimal React component and fire real
 * browser keyboard events to confirm end-to-end wiring.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetGameState, useGameStore } from '@/game/gameState';

// Mock honk — we only care that it was called
vi.mock('@/audio', () => ({
  honk: vi.fn(),
  audioBus: { setZone: vi.fn() },
  initAudioBusSafely: vi.fn(),
}));

import { honk } from '@/audio';
import { useKeyboardControls, useTitleKeyboard } from '@/hooks/useKeyboardControls';

// ─── Helper: fire a real KeyboardEvent on window ──────────────────────────────

function fireKey(key: string, type: 'keydown' | 'keyup' = 'keydown', code?: string) {
  const event = new KeyboardEvent(type, {
    key,
    code: code ?? key,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
}

// ─── useKeyboardControls ──────────────────────────────────────────────────────

describe('useKeyboardControls — real browser keyboard events', () => {
  beforeEach(() => {
    resetGameState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetGameState();
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
    useGameStore.getState().resume();
    expect(useGameStore.getState().paused).toBe(false);
  });

  it('P key does NOT pause — runner-style racer has no pause binding', async () => {
    useGameStore.getState().startRun({ seed: 1 });
    expect(useGameStore.getState().paused).toBe(false);

    const { unmount } = renderHook(() => useKeyboardControls());

    await act(async () => {
      fireKey('p');
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    expect(useGameStore.getState().paused).toBe(false);
    unmount();
  });

  it('Escape key does NOT pause — runner-style racer has no pause binding', async () => {
    useGameStore.getState().startRun({ seed: 1 });

    const { unmount } = renderHook(() => useKeyboardControls());

    await act(async () => {
      fireKey('Escape');
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    expect(useGameStore.getState().paused).toBe(false);
    unmount();
  });

  it('R key restarts on game-over via hook', async () => {
    useGameStore.getState().startRun({ seed: 1 });
    useGameStore.setState({ gameOver: true, running: false });

    const { unmount } = renderHook(() => useKeyboardControls());

    await act(async () => {
      fireKey('r');
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    expect(useGameStore.getState().running).toBe(true);
    expect(useGameStore.getState().gameOver).toBe(false);
    unmount();
  });

  it('H key fires honk during gameplay via hook', async () => {
    useGameStore.getState().startRun({ seed: 1 });

    const { unmount } = renderHook(() => useKeyboardControls());

    await act(async () => {
      fireKey('h');
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    expect(honk).toHaveBeenCalledTimes(1);
    unmount();
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

  it('cleanup: unmounting removes the window listener', async () => {
    useGameStore.getState().startRun({ seed: 1 });
    useGameStore.setState({ gameOver: true, running: false });
    const { unmount } = renderHook(() => useKeyboardControls());
    unmount();

    // Pressing R after unmount should not restart (listener removed)
    await act(async () => {
      fireKey('r');
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    // gameOver still true because the restart listener was removed
    expect(useGameStore.getState().gameOver).toBe(true);
    expect(useGameStore.getState().running).toBe(false);
  });
});

// ─── useTitleKeyboard ─────────────────────────────────────────────────────────

describe('useTitleKeyboard — real browser keyboard events', () => {
  it('Enter key fires onStart', async () => {
    const onStart = vi.fn();
    const onShop = vi.fn();
    const onEsc = vi.fn();

    const { unmount } = renderHook(() => useTitleKeyboard({ onStart, onShop, onEsc }));

    await act(async () => {
      fireKey('Enter');
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onShop).not.toHaveBeenCalled();
    unmount();
  });

  it('S key fires onShop', async () => {
    const onShop = vi.fn();
    const { unmount } = renderHook(() =>
      useTitleKeyboard({ onStart: vi.fn(), onShop, onEsc: vi.fn() }),
    );

    await act(async () => {
      fireKey('s');
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    expect(onShop).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('Escape key fires onEsc', async () => {
    const onEsc = vi.fn();
    const { unmount } = renderHook(() =>
      useTitleKeyboard({ onStart: vi.fn(), onShop: vi.fn(), onEsc }),
    );

    await act(async () => {
      fireKey('Escape');
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    expect(onEsc).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('T key fires onTour when provided', async () => {
    const onTour = vi.fn();
    const { unmount } = renderHook(() =>
      useTitleKeyboard({ onStart: vi.fn(), onTour, onShop: vi.fn(), onEsc: vi.fn() }),
    );

    await act(async () => {
      fireKey('t');
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    expect(onTour).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('Space key fires onStart', async () => {
    const onStart = vi.fn();
    const { unmount } = renderHook(() =>
      useTitleKeyboard({ onStart, onShop: vi.fn(), onEsc: vi.fn() }),
    );

    await act(async () => {
      fireKey(' ', 'keydown', 'Space');
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    expect(onStart).toHaveBeenCalledTimes(1);
    unmount();
  });
});
