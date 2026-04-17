import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ZoneBanner } from '../../components/ZoneBanner';
import { resetGameState, useGameStore } from '../../systems/gameState';

describe('<ZoneBanner />', () => {
  beforeEach(() => resetGameState());

  it('renders current zone name', () => {
    useGameStore.setState({ currentZone: 'midway-strip' });
    render(<ZoneBanner />);
    const banner = screen.getByTestId('zone-banner');
    expect(banner).toHaveTextContent('The Midway Strip');
  });

  it('updates when zone changes', () => {
    useGameStore.setState({ currentZone: 'midway-strip' });
    const { rerender } = render(<ZoneBanner />);
    expect(screen.getByTestId('zone-banner')).toHaveTextContent('The Midway Strip');
    useGameStore.setState({ currentZone: 'ring-of-fire' });
    rerender(<ZoneBanner />);
    expect(screen.getByTestId('zone-banner')).toHaveTextContent('Ring of Fire');
  });
});
