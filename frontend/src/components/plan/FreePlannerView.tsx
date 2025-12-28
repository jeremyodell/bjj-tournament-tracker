'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTournaments } from '@/hooks/useTournaments';
import { useSetupStore } from '@/stores/setupStore';
import { PlannerHeader } from './PlannerHeader';
import { TournamentCard } from '@/components/tournaments/TournamentCard';
import { TournamentCardSkeleton } from '@/components/tournaments/TournamentCardSkeleton';
import { LoginModal } from '@/components/auth/LoginModal';

type FilterTab = 'all' | 'nearby' | 'ibjjf' | 'jjwl';
type LoginContext = 'save' | 'favorite' | 'upgrade';

export function FreePlannerView() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginContext, setLoginContext] = useState<LoginContext>('save');
  const { athleteName } = useSetupStore();

  // Fetch kids tournaments
  const { data, isLoading, error } = useTournaments({ kids: true });

  // Flatten pages into single array
  const tournaments = data?.pages?.flatMap((page) => page.tournaments) || [];

  // Filter tournaments based on active tab
  const filteredTournaments = tournaments.filter((t) => {
    if (activeFilter === 'ibjjf') return t.org === 'IBJJF';
    if (activeFilter === 'jjwl') return t.org === 'JJWL';
    // TODO: nearby filter needs distance calculation
    return true;
  });

  const handleSave = () => {
    setLoginContext('save');
    setLoginModalOpen(true);
  };

  const handleEdit = () => {
    router.push('/plan');
  };

  const handleUpgrade = () => {
    setLoginContext('upgrade');
    setLoginModalOpen(true);
  };

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'nearby', label: 'Nearby < 4hrs' },
    { key: 'ibjjf', label: 'IBJJF' },
    { key: 'jjwl', label: 'JJWL' },
  ];

  return (
    <div className="container mx-auto px-4 py-8 pt-24">
      <PlannerHeader onSave={handleSave} onEdit={handleEdit} />

      {/* Tournament count and filters */}
      <div className="mb-6">
        <p className="text-lg mb-4">
          <span className="font-semibold">{filteredTournaments.length} tournaments</span>
          {' '}match {athleteName}&apos;s division
        </p>

        <div className="flex flex-wrap gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                activeFilter === tab.key
                  ? 'bg-[#d4af37] text-black'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tournament list */}
      <div className="space-y-4 mb-8">
        {isLoading ? (
          <>
            <TournamentCardSkeleton />
            <TournamentCardSkeleton />
            <TournamentCardSkeleton />
          </>
        ) : error ? (
          <div className="text-red-400 text-center py-8">
            Error loading tournaments
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="text-center py-8 opacity-60">
            No tournaments found
          </div>
        ) : (
          filteredTournaments.map((tournament, index) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              index={index}
            />
          ))
        )}
      </div>

      {/* Upgrade nudge */}
      <div
        className="p-4 rounded-xl border text-center"
        style={{
          background: 'rgba(212, 175, 55, 0.1)',
          borderColor: 'rgba(212, 175, 55, 0.3)',
        }}
      >
        <p className="mb-3">
          <span className="opacity-80">Overwhelmed?</span>
          {' '}
          Set your budget and let us pick the best tournaments for {athleteName}.
        </p>
        <button
          onClick={handleUpgrade}
          className="px-8 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 50%, #b8962a 100%)',
            color: '#000',
          }}
        >
          Try It
        </button>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        context={loginContext}
      />
    </div>
  );
}
