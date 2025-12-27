// frontend/src/app/page.tsx
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingHero } from '@/components/landing/LandingHero';
import { ValueProps } from '@/components/landing/ValueProps';
import { BottomCTA } from '@/components/landing/BottomCTA';
import { Footer } from '@/components/landing/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-black">
      <LandingNav />
      <LandingHero />
      <ValueProps />
      <BottomCTA />
      <Footer />
    </main>
  );
}
