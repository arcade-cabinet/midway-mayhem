/**
 * NewRunModal.browser.test.tsx
 *
 * Real-browser tests for <NewRunModal>:
 *   - all UI elements render
 *   - 6 difficulty tiles present
 *   - shuffle changes the seed phrase
 *   - permadeath toggle locked/unlocked/forced based on difficulty
 *   - clicking a tile selects it (aria-checked)
 *   - PLAY commits NewRunConfig to onPlay
 *   - ultra-nightmare auto-enables permadeath in config
 *   - Escape key fires onClose (real browser event loop — not fireEvent)
 *
 * Keyboard events via userEvent.setup() run through the real browser event
 * queue, exercising the window.addEventListener('keydown') handler inside
 * the component.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewRunModal } from '@/hud/NewRunModal';

describe('NewRunModal', () => {
  it('renders seed input, shuffle, difficulty grid, and play', () => {
    render(<NewRunModal onPlay={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('new-run-modal')).toBeInTheDocument();
    expect(screen.getByTestId('seed-phrase-input')).toBeInTheDocument();
    expect(screen.getByTestId('seed-phrase-shuffle')).toBeInTheDocument();
    expect(screen.getByTestId('difficulty-grid')).toBeInTheDocument();
    expect(screen.getByTestId('new-run-play')).toBeInTheDocument();
  });

  it('renders all 6 difficulty tiles', () => {
    render(<NewRunModal onPlay={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('difficulty-tile-silly')).toBeInTheDocument();
    expect(screen.getByTestId('difficulty-tile-kazoo')).toBeInTheDocument();
    expect(screen.getByTestId('difficulty-tile-plenty')).toBeInTheDocument();
    expect(screen.getByTestId('difficulty-tile-ultra-honk')).toBeInTheDocument();
    expect(screen.getByTestId('difficulty-tile-nightmare')).toBeInTheDocument();
    expect(screen.getByTestId('difficulty-tile-ultra-nightmare')).toBeInTheDocument();
  });

  it('shuffle swaps the phrase', async () => {
    const user = userEvent.setup();
    render(<NewRunModal onPlay={vi.fn()} onClose={vi.fn()} />);
    const input = screen.getByTestId('seed-phrase-input') as HTMLInputElement;
    const first = input.value;
    // With 3 pools of 50+ words each the collision probability is negligible.
    // Allow up to 5 attempts in the astronomically unlikely case of a collision.
    for (let i = 0; i < 5 && input.value === first; i++) {
      await user.click(screen.getByTestId('seed-phrase-shuffle'));
    }
    expect(input.value).not.toBe(first);
  });

  it('permadeath toggle is DISABLED below nightmare tier', () => {
    render(<NewRunModal onPlay={vi.fn()} onClose={vi.fn()} initialDifficulty="kazoo" />);
    const checkbox = screen.getByTestId('permadeath-toggle') as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.checked).toBe(false);
  });

  it('permadeath toggle is enabled on nightmare', () => {
    render(<NewRunModal onPlay={vi.fn()} onClose={vi.fn()} initialDifficulty="nightmare" />);
    const checkbox = screen.getByTestId('permadeath-toggle') as HTMLInputElement;
    expect(checkbox.disabled).toBe(false);
    expect(checkbox.checked).toBe(false);
  });

  it('permadeath toggle is FORCED ON for ultra-nightmare', () => {
    render(<NewRunModal onPlay={vi.fn()} onClose={vi.fn()} initialDifficulty="ultra-nightmare" />);
    const checkbox = screen.getByTestId('permadeath-toggle') as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.checked).toBe(true);
  });

  it('clicking a tile selects it', async () => {
    const user = userEvent.setup();
    render(<NewRunModal onPlay={vi.fn()} onClose={vi.fn()} />);
    const plenty = screen.getByTestId('difficulty-tile-plenty');
    await user.click(plenty);
    expect(plenty.getAttribute('aria-checked')).toBe('true');
  });

  it('PLAY commits a NewRunConfig to onPlay', async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();
    render(<NewRunModal onPlay={onPlay} onClose={vi.fn()} initialDifficulty="plenty" />);
    await user.click(screen.getByTestId('new-run-play'));
    expect(onPlay).toHaveBeenCalledTimes(1);
    const firstCall = onPlay.mock.calls[0];
    expect(firstCall).toBeDefined();
    const cfg = firstCall?.[0];
    expect(cfg).toBeDefined();
    expect(cfg.difficulty).toBe('plenty');
    expect(cfg.permadeath).toBe(false);
    expect(typeof cfg.seed).toBe('number');
    expect(typeof cfg.seedPhrase).toBe('string');
    expect(cfg.seedPhrase.length).toBeGreaterThan(0);
  });

  it('selecting ultra-nightmare auto-enables permadeath in the committed config', async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();
    render(<NewRunModal onPlay={onPlay} onClose={vi.fn()} initialDifficulty="kazoo" />);
    await user.click(screen.getByTestId('difficulty-tile-ultra-nightmare'));
    await user.click(screen.getByTestId('new-run-play'));
    const cfg = onPlay.mock.calls[0]?.[0];
    expect(cfg.permadeath).toBe(true);
    expect(cfg.difficulty).toBe('ultra-nightmare');
  });

  it('Escape key fires onClose (real browser event loop)', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NewRunModal onPlay={vi.fn()} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
