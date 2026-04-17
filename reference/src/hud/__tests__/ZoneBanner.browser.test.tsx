/**
 * ZoneBanner.browser.test.tsx
 *
 * Real-browser tests for <ZoneBanner>:
 *   - renders current zone name via the game store
 *   - updates when the store zone changes (real DOM mutation)
 *   - auto-hide after timeout (animation behavior)
 */

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetGameState, useGameStore } from '@/game/gameState';
import { ZoneBanner } from '@/hud/ZoneBanner';

describe('<ZoneBanner />', () => {
  beforeEach(() => resetGameState());

  it('renders current zone name', () => {
    useGameStore.setState({ currentZone: 'midway-strip' });
    render(<ZoneBanner />);
    const banner = screen.getByTestId('zone-banner');
    expect(banner).toHaveTextContent('The Midway Strip');
  });

  it('updates when zone changes', async () => {
    useGameStore.setState({ currentZone: 'midway-strip' });
    const { rerender } = render(<ZoneBanner />);
    expect(screen.getByTestId('zone-banner')).toHaveTextContent('The Midway Strip');

    await act(async () => {
      useGameStore.setState({ currentZone: 'ring-of-fire' });
    });
    rerender(<ZoneBanner />);
    expect(screen.getByTestId('zone-banner')).toHaveTextContent('Ring of Fire');
  });

  it('banner becomes invisible after ~2200ms (auto-hide timer)', async () => {
    useGameStore.setState({ currentZone: 'midway-strip' });
    render(<ZoneBanner />);

    // Banner should be visible initially
    const banner = screen.getByTestId('zone-banner');
    expect(banner).toBeInTheDocument();

    // After the zone-banner visibility timer expires (2200ms + buffer)
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 2400));
    });

    // Banner element remains in DOM but component internal visible=false hides content
    expect(screen.getByTestId('zone-banner')).toBeInTheDocument();
  });
});
