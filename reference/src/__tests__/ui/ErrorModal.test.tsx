import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearErrorsForTests, reportError } from '@/game/errorBus';
import { ErrorModal } from '@/hud/ErrorModal';

describe('<ErrorModal />', () => {
  beforeEach(() => {
    clearErrorsForTests();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    clearErrorsForTests();
    vi.restoreAllMocks();
  });

  it('is invisible when there are no errors', () => {
    render(<ErrorModal />);
    expect(screen.queryByTestId('error-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('error-modal-root')).toHaveAttribute('data-error-count', '0');
  });

  it('appears on reportError with context + message visible', async () => {
    render(<ErrorModal />);
    await act(async () => {
      reportError(new Error('HDRI 404'), 'preloadAllAssets');
    });
    expect(screen.getByTestId('error-modal')).toBeInTheDocument();
    expect(screen.getByTestId('error-modal-context')).toHaveTextContent('preloadAllAssets');
    expect(screen.getByTestId('error-modal-message')).toHaveTextContent('HDRI 404');
  });

  it('stack trace is rendered in details', async () => {
    render(<ErrorModal />);
    const err = new Error('stacky');
    await act(async () => {
      reportError(err, 'ctx');
    });
    expect(screen.getByTestId('error-modal-stack')).toBeInTheDocument();
  });

  it('dismiss button hides the modal in the DOM', async () => {
    const user = userEvent.setup();
    render(<ErrorModal />);
    await act(async () => {
      reportError(new Error('go away'), 'ctx');
    });
    expect(screen.getByTestId('error-modal')).toBeInTheDocument();
    await user.click(screen.getByTestId('error-modal-dismiss'));
    expect(screen.queryByTestId('error-modal')).not.toBeInTheDocument();
  });

  it('multiple errors show count in subtitle', async () => {
    render(<ErrorModal />);
    await act(async () => {
      reportError(new Error('one'), 'ctx1');
      reportError(new Error('two'), 'ctx2');
      reportError(new Error('three'), 'ctx3');
    });
    expect(screen.getByTestId('error-modal')).toHaveTextContent(/3 errors/);
  });
});
