import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { HUD } from '../../components/HUD';
import { resetGameState, useGameStore } from '../../systems/gameState';

describe('<HUD />', () => {
  beforeEach(() => resetGameState());

  it('renders all panels', () => {
    render(<HUD />);
    expect(screen.getByTestId('hud')).toBeInTheDocument();
    expect(screen.getByTestId('hud-hype')).toBeInTheDocument();
    expect(screen.getByTestId('hud-stats')).toBeInTheDocument();
    expect(screen.getByTestId('hud-sanity')).toBeInTheDocument();
    expect(screen.getByTestId('hud-crowd')).toBeInTheDocument();
  });

  it('shows the HONK button', () => {
    render(<HUD />);
    expect(screen.getByTestId('honk-button')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /honk/i })).toBeInTheDocument();
  });

  it('reflects current distance from store', () => {
    useGameStore.setState({ distance: 457, running: true });
    render(<HUD />);
    const stats = screen.getByTestId('hud-stats');
    expect(stats).toHaveTextContent(/457/);
  });

  it('shows game-over overlay only when gameOver is true', () => {
    render(<HUD />);
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument();

    useGameStore.setState({ gameOver: true, running: false, distance: 200 });
    const { rerender } = render(<HUD />);
    rerender(<HUD />);
    const overlays = screen.getAllByTestId('game-over');
    expect(overlays.length).toBeGreaterThan(0);
    // Overlay must contain the crowd-lost headline and the final distance
    expect(overlays[0]).toHaveTextContent(/crowd lost it/i);
    expect(overlays[0]).toHaveTextContent(/200/);
    // Restart button must be present inside the overlay
    expect(overlays[0]?.querySelector('[data-testid="restart-button"]')).toBeInTheDocument();
  });

  it('shows crowd reaction from store', () => {
    useGameStore.setState({ crowdReaction: 1234, running: true });
    render(<HUD />);
    expect(screen.getByTestId('hud-crowd')).toHaveTextContent(/1234/);
  });
});
