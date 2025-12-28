import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../utils';
import userEvent from '@testing-library/user-event';
import { QuickSetupForm } from '@/components/setup/QuickSetupForm';
import { useSetupStore } from '@/stores/setupStore';

describe('QuickSetupForm', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSetupStore.getState().reset();
  });

  it('renders all form fields', () => {
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    expect(screen.getByLabelText(/where are you based/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/athlete.*name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/age/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/belt/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/weight/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show me tournaments/i })).toBeInTheDocument();
  });

  it('submit button is disabled when form is incomplete', () => {
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    const submitButton = screen.getByRole('button', { name: /show me tournaments/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when all fields are filled', async () => {
    const user = userEvent.setup();
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/where are you based/i), 'Dallas, TX');
    await user.type(screen.getByLabelText(/athlete.*name/i), 'Sofia');
    await user.selectOptions(screen.getByLabelText(/age/i), '10');
    await user.selectOptions(screen.getByLabelText(/belt/i), 'gray');
    await user.selectOptions(screen.getByLabelText(/weight/i), '60');

    const submitButton = screen.getByRole('button', { name: /show me tournaments/i });
    expect(submitButton).toBeEnabled();
  });

  it('calls onComplete when form is submitted', async () => {
    const user = userEvent.setup();
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/where are you based/i), 'Dallas, TX');
    await user.type(screen.getByLabelText(/athlete.*name/i), 'Sofia');
    await user.selectOptions(screen.getByLabelText(/age/i), '10');
    await user.selectOptions(screen.getByLabelText(/belt/i), 'gray');
    await user.selectOptions(screen.getByLabelText(/weight/i), '60');

    await user.click(screen.getByRole('button', { name: /show me tournaments/i }));

    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it('stores data in setupStore', async () => {
    const user = userEvent.setup();
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/where are you based/i), 'Dallas, TX');
    await user.type(screen.getByLabelText(/athlete.*name/i), 'Sofia');
    await user.selectOptions(screen.getByLabelText(/age/i), '10');
    await user.selectOptions(screen.getByLabelText(/belt/i), 'gray');
    await user.selectOptions(screen.getByLabelText(/weight/i), '60');

    const state = useSetupStore.getState();
    expect(state.location).toBe('Dallas, TX');
    expect(state.athleteName).toBe('Sofia');
    expect(state.age).toBe(10);
    expect(state.belt).toBe('gray');
    expect(state.weight).toBe('60');
  });
});
