import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TitleScreen } from '../../components/TitleScreen';

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
});
