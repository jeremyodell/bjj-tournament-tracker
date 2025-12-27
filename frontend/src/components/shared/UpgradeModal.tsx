// frontend/src/components/shared/UpgradeModal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  athleteName?: string;
}

const features = [
  'Set your season budget',
  'See travel cost estimates',
  'AI optimizes your schedule',
  'One plan per athlete',
];

export function UpgradeModal({ isOpen, onClose, athleteName }: UpgradeModalProps) {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const setSubscription = useSubscriptionStore((state) => state.setSubscription);

  const handleClose = useCallback(() => {
    if (!isUpgrading) {
      onClose();
    }
  }, [isUpgrading, onClose]);

  // Handle escape key and body overflow
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, handleClose]);

  const handleUpgrade = async (plan: 'monthly' | 'yearly') => {
    setSelectedPlan(plan);
    setIsUpgrading(true);
    setUpgradeError(null);

    try {
      // Mock upgrade - simulate API call delay
      // In the future, this will redirect to Stripe checkout
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Calculate expiration date based on plan
      const expiresAt = new Date();
      if (plan === 'monthly') {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      setSubscription(true, expiresAt.toISOString());
      onClose();
    } catch (error) {
      setUpgradeError('Failed to process upgrade. Please try again.');
    } finally {
      setIsUpgrading(false);
      setSelectedPlan(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        className="relative w-full max-w-md mx-4 p-6 rounded-2xl border"
        style={{
          background: 'rgba(20, 20, 20, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl" role="img" aria-label="target">
            🎯
          </span>
          <h2 id="upgrade-modal-title" className="text-xl font-bold">Unlock Season Planner</h2>
        </div>

        {/* Description */}
        <p className="text-gray-400 mb-6">
          Get AI-powered tournament recommendations
          {athleteName ? ` for ${athleteName}` : ''} based on your budget and location.
        </p>

        {/* Features list */}
        <ul className="space-y-3 mb-8">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-[#d4af37] flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-gray-200">{feature}</span>
            </li>
          ))}
        </ul>

        {/* Pricing buttons */}
        <div className="flex gap-3 mb-4">
          {/* Monthly plan */}
          <button
            onClick={() => handleUpgrade('monthly')}
            disabled={isUpgrading}
            className="flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
              color: '#000',
            }}
          >
            {isUpgrading && selectedPlan === 'monthly' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Upgrading...
              </span>
            ) : (
              '$9.99/month'
            )}
          </button>

          {/* Yearly plan */}
          <button
            onClick={() => handleUpgrade('yearly')}
            disabled={isUpgrading}
            className="flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 border-2"
            style={{
              background: 'transparent',
              borderColor: '#d4af37',
              color: '#d4af37',
            }}
          >
            {isUpgrading && selectedPlan === 'yearly' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Upgrading...
              </span>
            ) : (
              <span className="flex flex-col items-center">
                <span>$79.99/year</span>
                <span className="text-xs opacity-80">(save 33%)</span>
              </span>
            )}
          </button>
        </div>

        {/* Error message */}
        {upgradeError && (
          <p className="text-red-500 text-sm text-center mb-4" role="alert">
            {upgradeError}
          </p>
        )}

        {/* Maybe Later button */}
        <button
          onClick={handleClose}
          disabled={isUpgrading}
          className="w-full py-3 rounded-lg font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}
