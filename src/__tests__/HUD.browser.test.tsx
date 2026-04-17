import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { HUD } from '@/hud/HUD';
import { resetGameState, useGameStore } from '@/game/gameState';

describe('<HUD /> browser', () => {
  beforeEach(() => resetGameState());

  it('renders correctly at 1280x720 with live store updates', () => {
    useGameStore.setState({
      hype: 75,
      distance: 456,
      crashes: 2,
      sanity: 60,
      crowdReaction: 1234,
      running: true,
    });
    render(<HUD />);
    expect(screen.getByTestId('hud')).toBeInTheDocument();
    expect(screen.getByTestId('hud-hype')).toHaveTextContent('75');
    expect(screen.getByTestId('hud-stats')).toHaveTextContent('456');
    expect(screen.getByTestId('hud-stats')).toHaveTextContent('2');
    expect(screen.getByTestId('hud-crowd')).toHaveTextContent('1234');
    expect(screen.getByTestId('honk-button')).toBeInTheDocument();
  });
});
