import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../utils';
import userEvent from '@testing-library/user-event';
import { QuickSetupForm } from '@/components/setup/QuickSetupForm';
import { useSetupStore } from '@/stores/setupStore';

// Mock the GymSelectionStep component
vi.mock('@/components/setup/GymSelectionStep', () => ({
  GymSelectionStep: ({ onContinue }: { onContinue: () => void }) => (
    <div data-testid="gym-selection-step">
      <button onClick={onContinue}>Continue to Location</button>
    </div>
  ),
}));

describe('QuickSetupForm', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSetupStore.getState().reset();
  });

  it('renders athlete info fields on first step', () => {
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    expect(screen.getByLabelText(/athlete.*first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/age/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/belt/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/weight/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('continue button is disabled when athlete info is incomplete', () => {
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    const submitButton = screen.getByRole('button', { name: /continue/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables continue button when all athlete info fields are filled', async () => {
    const user = userEvent.setup();
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/athlete.*first name/i), 'Sofia');
    await user.selectOptions(screen.getByLabelText(/age/i), '10');
    await user.selectOptions(screen.getByLabelText(/belt/i), 'gray');
    await user.selectOptions(screen.getByLabelText(/weight/i), '60');

    const submitButton = screen.getByRole('button', { name: /continue/i });
    expect(submitButton).toBeEnabled();
  });

  it('navigates through multi-step flow and calls onComplete', async () => {
    const user = userEvent.setup();
    // Pre-populate location so isComplete will be true
    useSetupStore.getState().setLocation('Dallas, TX');
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    // Step 1: Fill athlete info
    await user.type(screen.getByLabelText(/athlete.*first name/i), 'Sofia');
    await user.selectOptions(screen.getByLabelText(/age/i), '10');
    await user.selectOptions(screen.getByLabelText(/belt/i), 'gray');
    await user.selectOptions(screen.getByLabelText(/weight/i), '60');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Step 2: Gym selection (mocked)
    await waitFor(() => {
      expect(screen.getByTestId('gym-selection-step')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /continue to location/i }));

    // Step 3: Location
    await waitFor(() => {
      expect(screen.getByText(/where are you based/i)).toBeInTheDocument();
    });

    // Location should already be set, so submit button should be enabled
    await user.click(screen.getByRole('button', { name: /show me tournaments/i }));

    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it('stores athlete data in setupStore', async () => {
    const user = userEvent.setup();
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/athlete.*first name/i), 'Sofia');
    await user.selectOptions(screen.getByLabelText(/age/i), '10');
    await user.selectOptions(screen.getByLabelText(/belt/i), 'gray');
    await user.selectOptions(screen.getByLabelText(/weight/i), '60');

    const state = useSetupStore.getState();
    expect(state.athleteName).toBe('Sofia');
    expect(state.age).toBe(10);
    expect(state.belt).toBe('gray');
    expect(state.weight).toBe('60');
  });
});
