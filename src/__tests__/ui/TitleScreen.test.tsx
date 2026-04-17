import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TitleScreen } from '@/hud/TitleScreen';

// Leaderboard fetches from db — mock it for unit tests
vi.mock('@/hud/Leaderboard', () => ({
  Leaderboard: () => null,
}));

// TicketShop uses Canvas internals — mock it for unit tests
vi.mock('@/hud/TicketShop', () => ({
  TicketShop: () => null,
}));

// AchievementsPanel — mock it for unit tests
vi.mock('@/hud/AchievementsPanel', () => ({
  AchievementsPanel: () => null,
}));

// SettingsPanel — mock it for unit tests
vi.mock('@/hud/SettingsPanel', () => ({
  SettingsPanel: () => null,
}));

describe('<TitleScreen />', () => {
  it('renders landing hero + action cluster', () => {
    render(<TitleScreen onStart={() => {}} />);
    expect(screen.getByTestId('title-screen')).toBeInTheDocument();
    expect(screen.getByTestId('start-button')).toBeInTheDocument();
    expect(screen.getByText(/NEW RUN/i)).toBeInTheDocument();
    expect(screen.getByTestId('shop-button')).toBeInTheDocument();
    expect(screen.getByTestId('achievements-button')).toBeInTheDocument();
    expect(screen.getByTestId('settings-button')).toBeInTheDocument();
    expect(screen.getByTestId('title-ticket-balance')).toBeInTheDocument();
    // Hero art is painted as CSS background on the title container
    const container = screen.getByTestId('title-screen');
    expect(container.style.backgroundImage).toMatch(/background-landing\.png/);
  });

  it('clicking START opens the NewRunModal; PLAY commits config to onStart', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<TitleScreen onStart={onStart} />);
    await user.click(screen.getByTestId('start-button'));
    // Modal renders — assert its testid
    expect(screen.getByTestId('new-run-modal')).toBeInTheDocument();
    // PLAY commits
    await user.click(screen.getByTestId('new-run-play'));
    expect(onStart).toHaveBeenCalledTimes(1);
    const cfg = onStart.mock.calls[0]?.[0];
    expect(cfg).toBeDefined();
    expect(typeof cfg.seed).toBe('number');
    expect(typeof cfg.difficulty).toBe('string');
  });

  it('does not render the Visit Midway button (feature removed)', () => {
    render(<TitleScreen onStart={() => {}} />);
    expect(screen.queryByTestId('tour-button')).not.toBeInTheDocument();
  });
});
