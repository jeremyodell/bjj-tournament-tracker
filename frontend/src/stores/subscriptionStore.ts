// frontend/src/stores/subscriptionStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      isPro: false,
      tier: 'free',
      expiresAt: null,
      isLoading: false,

      setSubscription: (isPro: boolean, expiresAt?: string) => {
        set({
          isPro,
          tier: isPro ? 'pro' : 'free',
          expiresAt: expiresAt || null,
        });
      },

      checkSubscription: async () => {
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
