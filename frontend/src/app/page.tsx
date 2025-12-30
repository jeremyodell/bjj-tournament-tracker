// frontend/src/app/page.tsx
import { LandingHero } from '@/components/landing/LandingHero';
import { ValueProps } from '@/components/landing/ValueProps';
import { BottomCTA } from '@/components/landing/BottomCTA';
import { Footer } from '@/components/landing/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-black -mt-16">
      <LandingHero />
      <ValueProps />
      <BottomCTA />
      <Footer />
    </main>
  );
}
