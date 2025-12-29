// frontend/src/components/wishlist/WishlistCard.tsx
'use client';

import type { WishlistItem } from '@/lib/api';
import { useWishlistMutations } from '@/hooks/useWishlist';

interface WishlistCardProps {
  item: WishlistItem;
}

export function WishlistCard({ item }: WishlistCardProps) {
  const { removeMutation } = useWishlistMutations();
  const tournament = item.tournament;

  if (!tournament) {
    return null;
  }

  const startDate = new Date(tournament.startDate);
  const formattedDate = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isIBJJF = tournament.org === 'IBJJF';
  const accentColor = isIBJJF ? '#00F0FF' : '#FF2D6A';

  return (
    <div
      className="p-4 rounded-xl border flex items-center justify-between gap-4"
      style={{
        background: 'var(--glass-bg)',
        borderColor: 'var(--glass-border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="px-2 py-0.5 rounded text-xs font-bold"
            style={{ background: `${accentColor}20`, color: accentColor }}
          >
            {tournament.org}
          </span>
          <span className="text-sm opacity-60">{formattedDate}</span>
        </div>
        <h3 className="font-semibold truncate">{tournament.name}</h3>
        <p className="text-sm opacity-60 truncate">
          {tournament.city}{tournament.country ? `, ${tournament.country}` : ''}
        </p>
      </div>

      <button
        onClick={() => removeMutation.mutate(item.tournamentPK)}
        disabled={removeMutation.isPending}
        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-red-400"
        title="Remove from season"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
