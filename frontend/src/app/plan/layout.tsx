import { LandingNav } from '@/components/landing/LandingNav';

export default function PlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <LandingNav />
      {children}
    </div>
  );
}
