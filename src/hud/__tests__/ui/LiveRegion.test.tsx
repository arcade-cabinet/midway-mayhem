/**
 * LiveRegion tests
 *
 * Verifies that game events (crash, game-over, achievement) result in
 * the correct text appearing in the aria-live div.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { publishAchievement, resetAchievementBusForTests } from '@/game/achievementBus';
import { resetGameState, useGameStore } from '@/game/gameState';
import { LiveRegion } from '@/hud/LiveRegion';

describe('<LiveRegion />', () => {
  beforeEach(() => {
    resetGameState();
    resetAchievementBusForTests();
  });

  it('renders a visually-hidden aria-live div', () => {
    render(<LiveRegion />);
    const region = screen.getByTestId('live-region');
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
  });

  it('announces crash with sanity value', async () => {
    render(<LiveRegion />);

    // Set up running state
    act(() => {
      useGameStore.getState().startRun({ seed: 1 });
      useGameStore.setState({ sanity: 75 });
    });

    // Trigger a crash by incrementing crashes count
    act(() => {
      useGameStore.setState((prev) => ({ crashes: prev.crashes + 1 }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('live-region')).toHaveTextContent(/crash/i);
    });

    expect(screen.getByTestId('live-region')).toHaveTextContent('75');
  });

  it('announces game over with distance and crowd', async () => {
    render(<LiveRegion />);

    act(() => {
      useGameStore.getState().startRun({ seed: 1 });
      useGameStore.setState({ distance: 1200, crowdReaction: 4500 });
    });

    act(() => {
      useGameStore.setState({ gameOver: true, running: false });
    });

    await waitFor(() => {
      expect(screen.getByTestId('live-region')).toHaveTextContent(/run over/i);
    });

    expect(screen.getByTestId('live-region')).toHaveTextContent('1200');
    expect(screen.getByTestId('live-region')).toHaveTextContent('4500');
  });

  it('announces achievement unlocked', async () => {
    render(<LiveRegion />);

    act(() => {
      publishAchievement({
        slug: 'one-kilometre-clown',
        title: 'One Kilometre Clown',
        at: Date.now(),
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('live-region')).toHaveTextContent(/achievement unlocked/i);
    });

    expect(screen.getByTestId('live-region')).toHaveTextContent('One Kilometre Clown');
  });

  it('announces zone transition', async () => {
    render(<LiveRegion />);

    act(() => {
      useGameStore.getState().startRun({ seed: 1 });
      // Change zone to trigger announcement
      useGameStore.setState({ currentZone: 'balloon-alley' });
    });

    await waitFor(() => {
      const text = screen.getByTestId('live-region').textContent ?? '';
      expect(text.length).toBeGreaterThan(0);
    });
  });
});
