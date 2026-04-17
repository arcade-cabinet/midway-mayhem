/**
 * TitleScreen.browser.test.tsx
 *
 * Real-browser tests for <TitleScreen>:
 *   - hero layout + action cluster render
 *   - background-landing.png CSS applied
 *   - clicking START opens NewRunModal; PLAY commits config to onStart
 *   - tour button shown/hidden based on onTour prop
 *   - calling onTour from the button
 *
 * Leaderboard, TicketShop, AchievementsPanel, SettingsPanel are mocked because
 * they depend on SQLite / Capacitor APIs not available in the test harness.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// Leaderboard fetches from DB — mock it
vi.mock('@/hud/Leaderboard', () => ({
  Leaderboard: () => null,
}));

// TicketShop uses Canvas internals + DB — mock it
vi.mock('@/hud/TicketShop', () => ({
  TicketShop: () => null,
}));

// AchievementsPanel — mock it
vi.mock('@/hud/AchievementsPanel', () => ({
  AchievementsPanel: () => null,
}));

// SettingsPanel — mock it
vi.mock('@/hud/SettingsPanel', () => ({
  SettingsPanel: () => null,
}));

import { TitleScreen } from '@/hud/TitleScreen';

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
