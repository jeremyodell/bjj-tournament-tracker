import { describe, it, expect } from 'vitest';
import { render, screen } from '../../utils';
import { LandingHero } from '@/components/landing/LandingHero';

describe('LandingHero', () => {
  it('displays planner-first headline', () => {
    render(<LandingHero />);
    // Text is split across multiple elements, so check for parts
    expect(screen.getByText(/plan your kid/i)).toBeInTheDocument();
    expect(screen.getByText(/tournament season/i)).toBeInTheDocument();
  });

  it('has primary CTA linking to /plan', () => {
    render(<LandingHero />);
    const cta = screen.getByRole('link', { name: /start planning/i });
    expect(cta).toHaveAttribute('href', '/plan');
  });

  it('shows no account required message', () => {
    render(<LandingHero />);
    expect(screen.getByText(/no account required/i)).toBeInTheDocument();
  });

  it('has secondary CTA for browsing tournaments', () => {
    render(<LandingHero />);
    const link = screen.getByRole('link', { name: /browse tournaments/i });
    expect(link).toHaveAttribute('href', '/tournaments');
  });
});
