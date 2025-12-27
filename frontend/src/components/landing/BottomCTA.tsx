'use client';

import Link from 'next/link';

/**
 * BottomCTA - Centered CTA section after value props
 *
 * Design spec requirements:
 * - Centered CTA block after value props
 * - Generous whitespace above and below
 * - Headline: "Ready to plan your comp season?"
 * - Button: "Browse Tournaments" (gold gradient with glow, same as hero)
 */
export function BottomCTA() {
  return (
    <section className="relative w-full bg-black py-24 md:py-32 lg:py-40">
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(212, 175, 55, 0.03) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      {/* Content container */}
      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center md:px-8">
        {/* Headline */}
        <h2 className="font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.5rem]">
          Ready to plan your comp season?
        </h2>

        {/* CTA Button - Gold gradient with glow (matching hero) */}
        <div className="mt-10 md:mt-12">
          <Link
            href="/tournaments"
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-full px-8 py-4 text-base font-semibold transition-all duration-300 sm:px-10 sm:py-5 sm:text-lg"
            style={{
              background:
                'linear-gradient(135deg, #d4af37 0%, #c9a227 50%, #b8962a 100%)',
              boxShadow:
                '0 0 40px rgba(212, 175, 55, 0.3), 0 0 80px rgba(212, 175, 55, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            }}
          >
            {/* Glow bloom effect on hover */}
            <span
              className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{
                background:
                  'linear-gradient(135deg, #e5c453 0%, #d4af37 50%, #c9a227 100%)',
                boxShadow:
                  '0 0 60px rgba(212, 175, 55, 0.5), 0 0 120px rgba(212, 175, 55, 0.3)',
              }}
              aria-hidden="true"
            />
            <span className="relative z-10 text-black">Browse Tournaments</span>
            {/* Arrow icon */}
            <svg
              className="relative z-10 ml-2 h-5 w-5 text-black transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
