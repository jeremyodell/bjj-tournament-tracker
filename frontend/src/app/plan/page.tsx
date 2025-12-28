'use client';

import { useRouter } from 'next/navigation';
import { QuickSetupForm } from '@/components/setup/QuickSetupForm';

export default function PlanSetupPage() {
  const router = useRouter();

  const handleComplete = () => {
    router.push('/plan/results');
  };

  return (
    <main className="container mx-auto px-4 py-16">
      <div className="max-w-lg mx-auto pt-16">
        <p className="text-center text-sm opacity-60 mb-12">
          No account required
        </p>
        <QuickSetupForm onComplete={handleComplete} />
      </div>
    </main>
  );
}
