import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../utils';
import userEvent from '@testing-library/user-event';
import { LoginModal } from '@/components/auth/LoginModal';
import { useSetupStore } from '@/stores/setupStore';

describe('LoginModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSetupStore.getState().reset();
    useSetupStore.getState().setAthleteInfo({ athleteName: 'Sofia' });
  });

  it('renders when open', () => {
    render(<LoginModal isOpen={true} onClose={mockOnClose} context="save" />);
    expect(screen.getByText(/save.*season/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<LoginModal isOpen={false} onClose={mockOnClose} context="save" />);
    expect(screen.queryByText(/save.*season/i)).not.toBeInTheDocument();
  });

  it('shows Google login button', () => {
    render(<LoginModal isOpen={true} onClose={mockOnClose} context="save" />);
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
  });

  it('shows Email login button', () => {
    render(<LoginModal isOpen={true} onClose={mockOnClose} context="save" />);
    expect(screen.getByRole('button', { name: /email/i })).toBeInTheDocument();
  });

  it('shows sign in link for existing users', () => {
    render(<LoginModal isOpen={true} onClose={mockOnClose} context="save" />);
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginModal isOpen={true} onClose={mockOnClose} context="save" />);

    // Click the backdrop (the overlay div)
    const backdrop = screen.getByTestId('modal-backdrop');
    await user.click(backdrop);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
