import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TitleScreen } from '../../components/TitleScreen';

// Title3D uses @react-three/fiber Canvas which requires WebGL — mock it for jsdom
vi.mock('../../components/Title3D', () => ({
  Title3D: () => null,
}));

// Leaderboard fetches from db — mock it for unit tests
vi.mock('../../components/Leaderboard', () => ({
  Leaderboard: () => null,
}));

// TicketShop uses Canvas internals — mock it for unit tests
vi.mock('../../components/TicketShop', () => ({
  TicketShop: () => null,
}));

// AchievementsPanel — mock it for unit tests
vi.mock('../../components/AchievementsPanel', () => ({
  AchievementsPanel: () => null,
}));

// SettingsPanel — mock it for unit tests
vi.mock('../../components/SettingsPanel', () => ({
  SettingsPanel: () => null,
}));

describe('<TitleScreen />', () => {
  it('renders brand title + tagline + start button', () => {
    render(<TitleScreen onStart={() => {}} />);
    expect(screen.getByTestId('title-screen')).toBeInTheDocument();
    expect(screen.getByText(/MIDWAY/i)).toBeInTheDocument();
    expect(screen.getByText(/MAYHEM/i)).toBeInTheDocument();
    expect(screen.getByText(/clown car chaos/i)).toBeInTheDocument();
    expect(screen.getByText(/drive fast. honk louder/i)).toBeInTheDocument();
    expect(screen.getByTestId('start-button')).toBeInTheDocument();
  });

  it('calls onStart when START clicked', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<TitleScreen onStart={onStart} />);
    await user.click(screen.getByTestId('start-button'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('shows VISIT THE MIDWAY button when onTour is provided', () => {
    render(<TitleScreen onStart={() => {}} onTour={() => {}} />);
    expect(screen.getByTestId('tour-button')).toBeInTheDocument();
    expect(screen.getByText(/VISIT THE MIDWAY/i)).toBeInTheDocument();
  });

  it('calls onTour when VISIT THE MIDWAY clicked', async () => {
    const onTour = vi.fn();
    const user = userEvent.setup();
    render(<TitleScreen onStart={() => {}} onTour={onTour} />);
    await user.click(screen.getByTestId('tour-button'));
    expect(onTour).toHaveBeenCalledTimes(1);
  });

  it('does not show tour button when onTour is not provided', () => {
    render(<TitleScreen onStart={() => {}} />);
    expect(screen.queryByTestId('tour-button')).not.toBeInTheDocument();
  });
});
