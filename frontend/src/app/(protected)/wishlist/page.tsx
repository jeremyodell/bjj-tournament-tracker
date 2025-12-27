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
      <h1 className="text-3xl font-bold mb-8">My Wishlist</h1>

      {wishlist.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl opacity-60 mb-4">No tournaments saved yet</p>
          <Link
            href="/tournaments"
            className="inline-flex px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
              color: '#000',
            }}
          >
            Browse Tournaments
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {wishlist.map((item) => (
            <WishlistCard key={item.SK} item={item} />
          ))}
        </div>
      )}

      {wishlist.length > 0 && (
        <div className="mt-8 p-4 rounded-xl border text-center"
          style={{
            background: 'rgba(212, 175, 55, 0.1)',
            borderColor: 'rgba(212, 175, 55, 0.3)',
          }}
        >
          <p className="mb-3 opacity-80">Ready to plan your season?</p>
          <Link
            href="/profile"
            className="inline-flex px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
              color: '#000',
            }}
          >
            Add Athletes to Get Started
          </Link>
        </div>
      )}
    </div>
  );
}
