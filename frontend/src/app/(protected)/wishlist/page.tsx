// frontend/src/app/(protected)/wishlist/page.tsx
'use client';

import Link from 'next/link';
import { useWishlist } from '@/hooks/useWishlist';
import { WishlistCard } from '@/components/wishlist/WishlistCard';

export default function WishlistPage() {
  const { data, isLoading, error } = useWishlist();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Wishlist</h1>
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
        <h1 className="text-3xl font-bold mb-8">My Wishlist</h1>
        <div className="text-red-400">Error loading wishlist</div>
      </div>
    );
  }

  const wishlist = data?.wishlist || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Saved Tournaments</h1>
        <Link
          href="/plan"
          className="flex items-center gap-2 text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to My Season
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
    </div>
  );
}
