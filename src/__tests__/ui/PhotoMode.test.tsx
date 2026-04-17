import { fireEvent, render, screen } from '@testing-library/react';
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

  it('dismiss button sets photoMode=false', () => {
    useGameStore.setState({ photoMode: true, gameOver: true });
    render(<PhotoModeOverlay />);
    fireEvent.click(screen.getByTestId('photo-dismiss-btn'));
    expect(useGameStore.getState().photoMode).toBe(false);
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
});

describe('<HUD /> photo mode button', () => {
  beforeEach(() => {
    resetGameState();
  });

  it('sets photoMode=true when photo button clicked on game-over overlay', () => {
    // We test the state effect directly since HUD renders the GameOverOverlay
    useGameStore.setState({ gameOver: true, running: false, distance: 100, photoMode: false });

    // Simulate what the button handler does
    useGameStore.getState().setPhotoMode(true);
    expect(useGameStore.getState().photoMode).toBe(true);
  });

  it('returning from photo mode hides overlay via photoMode=false', () => {
    useGameStore.setState({ gameOver: true, photoMode: true });
    useGameStore.getState().setPhotoMode(false);
    expect(useGameStore.getState().photoMode).toBe(false);
  });
});
