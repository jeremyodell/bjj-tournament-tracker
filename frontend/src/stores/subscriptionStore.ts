// frontend/src/stores/subscriptionStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Dev mode - auto-enables Pro for testing
const IS_DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

interface SubscriptionState {
  isPro: boolean;
  tier: 'free' | 'pro';
  expiresAt: string | null;
  isLoading: boolean;

  // Actions
  setSubscription: (isPro: boolean, expiresAt?: string) => void;
  checkSubscription: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      isPro: IS_DEV_MODE, // Auto-enable Pro in dev mode
      tier: IS_DEV_MODE ? 'pro' : 'free',
      expiresAt: null,
      isLoading: !IS_DEV_MODE,  // Skip loading state in dev mode

      setSubscription: (isPro: boolean, expiresAt?: string) => {
        set({
          isPro,
          tier: isPro ? 'pro' : 'free',
          expiresAt: expiresAt || null,
        });
      },

      checkSubscription: async () => {
        // In dev mode, always set as Pro
        if (IS_DEV_MODE) {
          set({ isPro: true, tier: 'pro', isLoading: false });
          console.log('[DEV MODE] Subscription set to Pro');
          return;
        }

        set({ isLoading: true });

        try {
          // For now, this is client-side only with mock functionality.
          // Later, this will call the backend to verify subscription status.
          const { expiresAt } = get();

          if (expiresAt) {
            const isExpired = new Date(expiresAt) < new Date();
            if (isExpired) {
              set({ isPro: false, tier: 'free', expiresAt: null });
            }
          }

          // TODO: Add actual API call to verify subscription
          // const response = await api.get('/subscription/status');
          // set({ isPro: response.isPro, tier: response.tier, expiresAt: response.expiresAt });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'subscription-storage',
      partialize: (state) => ({
        isPro: state.isPro,
        tier: state.tier,
        expiresAt: state.expiresAt,
      }),
    }
  )
);
