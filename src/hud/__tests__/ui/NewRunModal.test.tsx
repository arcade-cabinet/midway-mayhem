import { fireEvent, render, screen } from '@testing-library/react';
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

  it('shuffle swaps the phrase', () => {
    render(<NewRunModal onPlay={vi.fn()} onClose={vi.fn()} />);
    const input = screen.getByTestId('seed-phrase-input') as HTMLInputElement;
    const first = input.value;
    fireEvent.click(screen.getByTestId('seed-phrase-shuffle'));
    // Could rarely collide, but with 3 pools of 50+ it's vanishingly unlikely.
    // Run multiple times until it differs, failing if 5 attempts produce no change.
    for (let i = 0; i < 5 && input.value === first; i++) {
      fireEvent.click(screen.getByTestId('seed-phrase-shuffle'));
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

  it('clicking a tile selects it', () => {
    render(<NewRunModal onPlay={vi.fn()} onClose={vi.fn()} />);
    const plenty = screen.getByTestId('difficulty-tile-plenty');
    fireEvent.click(plenty);
    expect(plenty.getAttribute('aria-checked')).toBe('true');
  });

  it('PLAY commits a NewRunConfig to onPlay', () => {
    const onPlay = vi.fn();
    render(<NewRunModal onPlay={onPlay} onClose={vi.fn()} initialDifficulty="plenty" />);
    fireEvent.click(screen.getByTestId('new-run-play'));
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

  it('selecting ultra-nightmare auto-enables permadeath in the committed config', () => {
    const onPlay = vi.fn();
    render(<NewRunModal onPlay={onPlay} onClose={vi.fn()} initialDifficulty="kazoo" />);
    fireEvent.click(screen.getByTestId('difficulty-tile-ultra-nightmare'));
    fireEvent.click(screen.getByTestId('new-run-play'));
    const cfg = onPlay.mock.calls[0]?.[0];
    expect(cfg.permadeath).toBe(true);
    expect(cfg.difficulty).toBe('ultra-nightmare');
  });

  it('Escape key closes modal', () => {
    const onClose = vi.fn();
    render(<NewRunModal onPlay={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
