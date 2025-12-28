'use client';

import { useState } from 'react';
import { useSetupStore } from '@/stores/setupStore';
import { useAuthStore } from '@/stores/authStore';
import { signInWithGoogle } from '@/lib/auth';
import { GoogleSignInButton } from './GoogleSignInButton';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: 'save' | 'favorite' | 'upgrade';
}

export function LoginModal({ isOpen, onClose, context }: LoginModalProps) {
  const { athleteName } = useSetupStore();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [googleLoading, setGoogleLoading] = useState(false);

  if (!isOpen) return null;

  // If already authenticated, close modal and refresh auth state
  if (isAuthenticated) {
    checkAuth();
    onClose();
    return null;
  }

  const getTitle = () => {
    switch (context) {
      case 'save':
        return `Save ${athleteName}'s Season`;
      case 'favorite':
        return 'Save this tournament';
      case 'upgrade':
        return `Unlock ${athleteName}'s Optimized Season`;
    }
  };

  const getSubtitle = () => {
    switch (context) {
      case 'save':
      case 'favorite':
        return "Create a free account to save your plan and favorites. We'll remind you when registration opens.";
      case 'upgrade':
        return 'Get AI-powered tournament recommendations based on your budget and location.';
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Google sign-in error:', error);
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = () => {
    // TODO: Redirect to email login/signup
    window.location.href = '/register';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="modal-backdrop"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-zinc-900 rounded-2xl p-8 max-w-md w-full border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-2">{getTitle()}</h2>
        <p className="text-sm opacity-60 mb-8">{getSubtitle()}</p>

        <div className="space-y-3">
          <GoogleSignInButton
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            loading={googleLoading}
          />

          <button
            onClick={handleEmailLogin}
            className="w-full py-3 px-4 rounded-lg bg-white/10 font-medium flex items-center justify-center gap-3 hover:bg-white/20 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Continue with Email
          </button>
        </div>

        <div className="mt-6 text-center text-sm opacity-60">
          Already have an account?{' '}
          <a href="/login" className="text-[#d4af37] hover:underline">
            Sign in
          </a>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
