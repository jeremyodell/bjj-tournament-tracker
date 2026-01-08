import { useSetupStore } from '@/stores/setupStore';
import { fetchAthletes, type Athlete } from '@/lib/api';

export interface RedirectResult {
  path: string;
  athlete?: Athlete; // Set when auto-selecting single athlete
}

/**
 * Determines where to redirect after successful login based on:
 * - setupStore data (if user was filling out the planner)
 * - Number of athletes the user has
 */
export async function getPostLoginRedirect(
  accessToken: string
): Promise<RedirectResult> {
  const { isComplete } = useSetupStore.getState();

  // If user has setupStore data, they were filling out the planner
  // Send them to verify page to confirm and save their athlete
  if (isComplete) {
    return { path: '/plan/verify' };
  }

  // No setupStore data - check their athletes
  try {
    const data = await fetchAthletes(accessToken);
    const athletes = data.athletes;

    if (athletes.length === 0) {
      // No athletes - go to onboarding
      return { path: '/onboarding' };
    } else if (athletes.length === 1) {
      // Single athlete - auto-select and go to wishlist
      return { path: '/wishlist', athlete: athletes[0] };
    } else {
      // Multiple athletes - go to select page
      return { path: '/plan/select' };
    }
  } catch {
    // On error, fall back to onboarding (safest default for new users)
    return { path: '/onboarding' };
  }
}
