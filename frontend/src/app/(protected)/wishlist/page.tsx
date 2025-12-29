// frontend/src/app/(protected)/wishlist/page.tsx
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useWishlist } from '@/hooks/useWishlist';
import { useTournaments } from '@/hooks/useTournaments';
import { WishlistCard } from '@/components/wishlist/WishlistCard';
import { TournamentCard } from '@/components/tournaments/TournamentCard';

const SUGGESTIONS_LIMIT = 6;

export default function WishlistPage() {
  const { data, isLoading, error } = useWishlist();
  const { data: tournamentsData, isLoading: tournamentsLoading } = useTournaments();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Season</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Season</h1>
        <div className="text-red-400">Error loading season</div>
      </div>
    );
  }

  const wishlist = data?.wishlist || [];

  // Get IDs of tournaments already in wishlist
  const wishlistTournamentIds = useMemo(() => {
    return new Set(wishlist.map(item => item.tournamentPK));
  }, [wishlist]);

  // Get suggested tournaments (not in wishlist, limited to SUGGESTIONS_LIMIT)
  const suggestedTournaments = useMemo(() => {
    if (!tournamentsData?.pages) return [];

    const allTournaments = tournamentsData.pages.flatMap(page => page.tournaments);
    const filtered = allTournaments.filter(t => !wishlistTournamentIds.has(t.id));
    return filtered.slice(0, SUGGESTIONS_LIMIT);
  }, [tournamentsData, wishlistTournamentIds]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">My Season</h1>
        <Link
          href="/tournaments"
          className="flex items-center gap-2 text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
        >
          Find More Tournaments
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      {wishlist.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl opacity-60 mb-4">No tournaments saved yet</p>
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 50%, #b8962a 100%)',
              color: '#000',
              boxShadow: '0 0 40px rgba(212, 175, 55, 0.3), 0 0 80px rgba(212, 175, 55, 0.15)',
            }}
          >
            Browse Tournaments
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {wishlist.map((item) => (
            <WishlistCard key={item.SK} item={item} />
          ))}
        </div>
      )}

      {/* Suggested Tournaments Section - only show when wishlist has items */}
      {wishlist.length > 0 && (
        <div className="mt-16 pt-8 border-t" style={{ borderColor: 'var(--glass-border)' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Suggested Tournaments</h2>
            <Link
              href="/tournaments"
              className="text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
            >
              View All
            </Link>
          </div>

          {tournamentsLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : suggestedTournaments.length === 0 ? (
            <div className="text-center py-8">
              <p className="opacity-60">No more tournaments to suggest</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {suggestedTournaments.map((tournament, index) => (
                <TournamentCard key={tournament.id} tournament={tournament} index={index} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
