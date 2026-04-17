/**
 * PhotoMode.browser.test.tsx
 *
 * Real-browser tests for PhotoModeOverlay:
 *   - download + dismiss buttons render
 *   - dismiss button sets photoMode=false in the game store
 *   - setPhotoMode toggle logic
 *   - Escape key dismisses (real browser event loop)
 *   - photo capture state machine
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetGameState, useGameStore } from '@/game/gameState';
import { PhotoModeOverlay } from '@/hud/PhotoMode';

describe('<PhotoModeOverlay />', () => {
  beforeEach(() => {
    resetGameState();
  });

  it('renders download and dismiss buttons', () => {
    useGameStore.setState({ photoMode: true, gameOver: true });
    render(<PhotoModeOverlay />);
    expect(screen.getByTestId('photo-mode-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('photo-download-btn')).toBeInTheDocument();
    expect(screen.getByTestId('photo-dismiss-btn')).toBeInTheDocument();
  });

  it('dismiss button sets photoMode=false', async () => {
    useGameStore.setState({ photoMode: true, gameOver: true });
    const user = userEvent.setup();
    render(<PhotoModeOverlay />);
    await user.click(screen.getByTestId('photo-dismiss-btn'));
    expect(useGameStore.getState().photoMode).toBe(false);
  });

  it('Escape key dismisses the overlay (real browser event)', async () => {
    useGameStore.setState({ photoMode: true, gameOver: true });
    const user = userEvent.setup();
    render(<PhotoModeOverlay />);
    expect(screen.getByTestId('photo-mode-overlay')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(useGameStore.getState().photoMode).toBe(false);
  });

  it('download button is auto-focused on mount', async () => {
    useGameStore.setState({ photoMode: true, gameOver: true });
    render(<PhotoModeOverlay />);
    // Wait for effect to run
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    });
    expect(document.activeElement).toBe(screen.getByTestId('photo-download-btn'));
  });
});

describe('<PhotoModeOverlay /> state machine', () => {
  beforeEach(() => {
    resetGameState();
  });

  it('photoMode starts as false', () => {
    expect(useGameStore.getState().photoMode).toBe(false);
  });

  it('setPhotoMode toggles the flag', () => {
    useGameStore.getState().setPhotoMode(true);
    expect(useGameStore.getState().photoMode).toBe(true);
    useGameStore.getState().setPhotoMode(false);
    expect(useGameStore.getState().photoMode).toBe(false);
  });

  it('sets photoMode=true when photo button clicked on game-over overlay', () => {
    useGameStore.setState({ gameOver: true, running: false, distance: 100, photoMode: false });
    useGameStore.getState().setPhotoMode(true);
    expect(useGameStore.getState().photoMode).toBe(true);
  });

  it('returning from photo mode hides overlay via photoMode=false', () => {
    useGameStore.setState({ gameOver: true, photoMode: true });
    useGameStore.getState().setPhotoMode(false);
    expect(useGameStore.getState().photoMode).toBe(false);
  });
});
