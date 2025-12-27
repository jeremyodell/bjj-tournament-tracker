// frontend/src/app/(auth)/register/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      await register(email, password);
      router.push(`/confirm?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <div
      className="p-8 rounded-2xl border"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <h1 className="text-2xl font-bold text-center mb-6">Create Account</h1>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 opacity-80">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#d4af37] focus:outline-none transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 opacity-80">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#d4af37] focus:outline-none transition-colors"
            required
            minLength={8}
          />
          <p className="mt-1 text-xs opacity-50">At least 8 characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 opacity-80">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#d4af37] focus:outline-none transition-colors"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
            color: '#000',
          }}
        >
          {isLoading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm opacity-60">
        Already have an account?{' '}
        <Link href="/login" className="text-[#d4af37] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
