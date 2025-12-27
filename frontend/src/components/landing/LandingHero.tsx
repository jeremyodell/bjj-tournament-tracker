'use client';

import Link from 'next/link';
import { BeltWeaveBackground } from './BeltWeaveBackground';

/**
 * LandingHero - Asymmetric hero section with angled screenshot
 *
 * Design spec requirements:
 * - Full-width dark hero with animated belt weave pattern background
 * - Asymmetric layout - break the typical 50/50 split
 * - Left side: Headline + subheadline + CTA button (40%)
 * - Right side: Screenshot at dramatic 12-15 degree angle, overlapping the fold (60%)
 * - Gold gradient CTA button with soft glow/bloom effect
 * - Screenshot framed with frosted glass border
 * - Hero content: Fade in + slight upward slide on load
 * - Screenshot: Fade in with slight scale (0.95 -> 1) after hero text
 * - Mobile: Stack headline above screenshot, full-width CTA
 */
export function LandingHero() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* Belt Weave Background */}
      <BeltWeaveBackground />

      {/* Gradient overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 40%, rgba(212, 175, 55, 0.04) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 60%, rgba(212, 175, 55, 0.02) 0%, transparent 50%)',
        }}
        aria-hidden="true"
      />

      {/* Main hero container */}
      <div className="relative z-10 mx-auto max-w-[1400px] px-6 md:px-8 lg:px-12">
        <div className="grid min-h-screen grid-cols-1 items-center gap-8 lg:grid-cols-[40%_60%] lg:gap-0">
          {/* Left Content - Headline, Subheadline, CTA */}
          <div className="pt-24 lg:pt-0 lg:pr-8 xl:pr-16">
            {/* Headline */}
            <h1
              className="font-[family-name:var(--font-display)] text-5xl leading-[1.1] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[5.5rem] animate-hero-fade-in"
              style={{
                animationDelay: '0.1s',
                animationFillMode: 'both',
              }}
            >
              Find your next
              <br />
              <span
                className="relative inline-block"
                style={{
                  background:
                    'linear-gradient(135deg, #d4af37 0%, #f5e6b3 40%, #d4af37 60%, #c9a227 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                competition
              </span>
            </h1>

            {/* Subheadline */}
            <p
              className="mt-6 max-w-md text-lg leading-relaxed text-white/60 sm:text-xl md:mt-8 md:text-[1.35rem] animate-hero-fade-in"
              style={{
                animationDelay: '0.25s',
                animationFillMode: 'both',
              }}
            >
              IBJJF and JJWL tournaments in one place.
              <br className="hidden sm:block" />
              Plan your season, budget smarter.
            </p>

            {/* CTA Button - Gold gradient with glow */}
            <div
              className="mt-8 md:mt-10 animate-hero-fade-in"
              style={{
                animationDelay: '0.4s',
                animationFillMode: 'both',
              }}
            >
              <Link
                href="/tournaments"
                className="group relative inline-flex items-center justify-center overflow-hidden rounded-full px-8 py-4 text-base font-semibold transition-all duration-300 sm:px-10 sm:py-5 sm:text-lg w-full sm:w-auto"
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
                <span className="relative z-10 text-black">
                  Browse Tournaments
                </span>
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

          {/* Right Content - Angled Screenshot */}
          <div className="relative flex items-center justify-center pb-12 lg:pb-0 lg:pl-4 overflow-visible">
            {/* Screenshot container with dramatic angle - bleeds off-screen on mobile */}
            <div
              className="relative w-full max-w-[600px] lg:max-w-none animate-hero-screenshot translate-x-[15%] sm:translate-x-[10%] lg:translate-x-0"
              style={{
                animationDelay: '0.55s',
                animationFillMode: 'both',
              }}
            >
              {/* Gold-tinted shadow layer */}
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  transform: 'rotate(12deg) translateX(20px) translateY(30px)',
                  background:
                    'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%)',
                  filter: 'blur(40px)',
                }}
                aria-hidden="true"
              />

              {/* Main screenshot frame */}
              <div
                className="relative overflow-hidden rounded-2xl"
                style={{
                  transform: 'rotate(12deg)',
                  background:
                    'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  backdropFilter: 'blur(20px)',
                  boxShadow:
                    '0 25px 80px -12px rgba(0, 0, 0, 0.5), 0 0 60px rgba(212, 175, 55, 0.1)',
                }}
              >
                {/* Browser chrome mockup */}
                <div
                  className="flex items-center gap-2 px-4 py-3"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  {/* Traffic lights */}
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-[#ff5f57] opacity-80" />
                    <div className="h-3 w-3 rounded-full bg-[#febc2e] opacity-80" />
                    <div className="h-3 w-3 rounded-full bg-[#28c840] opacity-80" />
                  </div>
                  {/* URL bar */}
                  <div
                    className="ml-4 flex-1 rounded-md px-3 py-1.5 text-xs text-white/40"
                    style={{ background: 'rgba(255, 255, 255, 0.06)' }}
                  >
                    bjjcomps.com/tournaments
                  </div>
                </div>

                {/* App screenshot content - styled mock */}
                <div
                  className="p-4 sm:p-6"
                  style={{ background: 'rgba(0, 0, 0, 0.4)' }}
                >
                  {/* Header area */}
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <div className="mb-2 h-4 w-32 rounded bg-white/20" />
                      <div className="h-3 w-20 rounded bg-white/10" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-16 rounded-md bg-white/10" />
                      <div className="h-8 w-8 rounded-md bg-[#d4af37]/30" />
                    </div>
                  </div>

                  {/* Tournament cards grid */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* IBJJF Card */}
                    <div
                      className="rounded-xl p-4"
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(0, 240, 255, 0.3)',
                        boxShadow: '0 0 20px rgba(0, 240, 255, 0.1)',
                      }}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ background: '#00F0FF' }}
                        />
                        <span className="text-xs font-medium text-[#00F0FF]">
                          IBJJF
                        </span>
                      </div>
                      <div className="mb-2 h-3 w-28 rounded bg-white/25" />
                      <div className="mb-3 h-2 w-20 rounded bg-white/10" />
                      <div className="flex justify-between text-xs text-white/40">
                        <span>Mar 2025</span>
                        <span
                          className="font-medium"
                          style={{ color: '#d4af37' }}
                        >
                          $150
                        </span>
                      </div>
                    </div>

                    {/* JJWL Card */}
                    <div
                      className="rounded-xl p-4"
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 45, 106, 0.3)',
                        boxShadow: '0 0 20px rgba(255, 45, 106, 0.1)',
                      }}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ background: '#FF2D6A' }}
                        />
                        <span className="text-xs font-medium text-[#FF2D6A]">
                          JJWL
                        </span>
                      </div>
                      <div className="mb-2 h-3 w-24 rounded bg-white/25" />
                      <div className="mb-3 h-2 w-16 rounded bg-white/10" />
                      <div className="flex justify-between text-xs text-white/40">
                        <span>Apr 2025</span>
                        <span
                          className="font-medium"
                          style={{ color: '#d4af37' }}
                        >
                          $120
                        </span>
                      </div>
                    </div>

                    {/* Additional IBJJF Card */}
                    <div
                      className="rounded-xl p-4"
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(0, 240, 255, 0.3)',
                        boxShadow: '0 0 20px rgba(0, 240, 255, 0.1)',
                      }}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ background: '#00F0FF' }}
                        />
                        <span className="text-xs font-medium text-[#00F0FF]">
                          IBJJF
                        </span>
                      </div>
                      <div className="mb-2 h-3 w-32 rounded bg-white/25" />
                      <div className="mb-3 h-2 w-18 rounded bg-white/10" />
                      <div className="flex justify-between text-xs text-white/40">
                        <span>May 2025</span>
                        <span
                          className="font-medium"
                          style={{ color: '#d4af37' }}
                        >
                          $200
                        </span>
                      </div>
                    </div>

                    {/* Placeholder Card */}
                    <div
                      className="rounded-xl p-4 opacity-60"
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px dashed rgba(255, 255, 255, 0.15)',
                      }}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-white/20" />
                        <div className="h-2 w-10 rounded bg-white/10" />
                      </div>
                      <div className="mb-2 h-3 w-20 rounded bg-white/10" />
                      <div className="mb-3 h-2 w-14 rounded bg-white/5" />
                      <div className="flex justify-between text-xs text-white/20">
                        <span>---</span>
                        <span>---</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom pagination dots */}
                  <div className="mt-6 flex justify-center gap-1.5">
                    <div
                      className="h-1.5 w-6 rounded-full"
                      style={{ background: '#d4af37' }}
                    />
                    <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                    <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  </div>
                </div>
              </div>

              {/* Decorative floating element */}
              <div
                className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-30 blur-2xl lg:-right-8 lg:-top-8 lg:h-32 lg:w-32"
                style={{
                  background:
                    'radial-gradient(circle, #d4af37 0%, transparent 70%)',
                }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade for overlap effect */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 100%)',
        }}
        aria-hidden="true"
      />

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes hero-fade-in {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes hero-screenshot {
          from {
            opacity: 0;
            transform: scale(0.95) rotate(12deg);
          }
          to {
            opacity: 1;
            transform: scale(1) rotate(12deg);
          }
        }

        .animate-hero-fade-in {
          animation: hero-fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }

        .animate-hero-screenshot {
          animation: hero-screenshot 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
      `}</style>
    </section>
  );
}
