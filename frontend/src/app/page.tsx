// frontend/src/app/page.tsx
import { ScoreboardHero } from '@/components/home/ScoreboardHero';
import { TournamentDiscovery } from '@/components/home/TournamentDiscovery';
import { Footer } from '@/components/landing/Footer';

export default function Home() {
  return (
    <main className="min-h-screen -mt-16">
      <ScoreboardHero />
      <TournamentDiscovery />
      <Footer />
    </main>
  );
}
