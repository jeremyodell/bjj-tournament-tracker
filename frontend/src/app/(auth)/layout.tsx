// frontend/src/app/(auth)/layout.tsx
import { BeltWeaveBackground } from '@/components/landing/BeltWeaveBackground';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen relative flex items-center justify-center">
      <BeltWeaveBackground />
      <div className="relative z-10 w-full max-w-md px-4">
        {children}
      </div>
    </div>
  );
}
