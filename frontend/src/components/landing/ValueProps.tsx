'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * ValueProps - Staggered scroll-animated value proposition cards
 *
 * Design spec requirements:
 * - 3-column grid on desktop, stacked on mobile
 * - Cards have subtle border, slight elevation
 * - Cards overlap slightly instead of perfect grid alignment
 * - Staggered reveal animation as user scrolls into view (animation-delay per card)
 * - Icons are line-style, gold color with subtle shimmer on hover
 * - Text is white/light gray on dark
 * - Minimal - no long paragraphs, just scannable
 */

interface ValueProp {
  icon: React.ReactNode;
  headline: string;
  description: string;
}

const valueProps: ValueProp[] = [
  {
    icon: <CalendarMergedIcon />,
    headline: 'One calendar, all orgs',
    description: 'IBJJF and JJWL schedules unified. No more tab-switching.',
  },
  {
    icon: <MapPinRouteIcon />,
    headline: 'Find comps near you',
    description: "Filter by location and see what's worth the drive.",
  },
  {
    icon: <SparkleAIIcon />,
    headline: 'Plan your season',
    description: 'AI helps you build the optimal tournament schedule for your budget.',
  },
];

export function ValueProps() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full py-24 md:py-32 lg:py-40 bg-black overflow-hidden"
    >
      {/* Subtle gradient backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(212, 175, 55, 0.02) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 md:px-8 lg:px-12">
        {/* Section heading */}
        <div
          className={`text-center mb-16 md:mb-20 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-[family-name:var(--font-display)] tracking-tight text-white mb-4"
          >
            Everything you need to{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #d4af37 0%, #f5e6b3 50%, #d4af37 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              compete
            </span>
          </h2>
          <p className="text-white/50 text-lg md:text-xl max-w-md mx-auto">
            Built by competitors, for competitors.
          </p>
        </div>

        {/* Value prop cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 lg:gap-6">
          {valueProps.map((prop, index) => (
            <ValuePropCard
              key={prop.headline}
              {...prop}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>

      {/* CSS for shimmer animation */}
      <style jsx>{`
        @keyframes icon-shimmer {
          0%, 100% {
            opacity: 1;
            filter: drop-shadow(0 0 4px rgba(212, 175, 55, 0.3));
          }
          50% {
            opacity: 0.85;
            filter: drop-shadow(0 0 8px rgba(212, 175, 55, 0.5));
          }
        }
      `}</style>
    </section>
  );
}

interface ValuePropCardProps extends ValueProp {
  index: number;
  isVisible: boolean;
}

function ValuePropCard({ icon, headline, description, index, isVisible }: ValuePropCardProps) {
  // Staggered offset for overlapping effect
  const offsets = [
    'md:translate-y-0',
    'md:translate-y-4',
    'md:translate-y-2',
  ];

  return (
    <div
      className={`
        group relative p-6 md:p-7 lg:p-8 rounded-2xl
        transition-all duration-700 ease-out
        ${offsets[index]}
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}
      `}
      style={{
        transitionDelay: isVisible ? `${150 + index * 150}ms` : '0ms',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 4px 24px -4px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Hover glow effect */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(212, 175, 55, 0.06) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      {/* Icon container */}
      <div
        className="relative mb-5 w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105"
        style={{
          background: 'rgba(212, 175, 55, 0.08)',
          border: '1px solid rgba(212, 175, 55, 0.15)',
        }}
      >
        <div
          className="text-[#d4af37] transition-all duration-300"
          style={{
            filter: 'drop-shadow(0 0 4px rgba(212, 175, 55, 0.3))',
          }}
        >
          {icon}
        </div>
        {/* Shimmer overlay on hover */}
        <div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, transparent 50%, rgba(212, 175, 55, 0.1) 100%)',
          }}
          aria-hidden="true"
        />
      </div>

      {/* Headline */}
      <h3 className="relative text-lg md:text-xl font-semibold text-white mb-2 tracking-tight">
        {headline}
      </h3>

      {/* Description */}
      <p className="relative text-sm md:text-base text-white/55 leading-relaxed">
        {description}
      </p>

      {/* Bottom accent line on hover */}
      <div
        className="absolute bottom-0 left-6 right-6 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(212, 175, 55, 0.3) 50%, transparent 100%)',
        }}
        aria-hidden="true"
      />
    </div>
  );
}

// SVG Icon Components - Line-style, 24x24

function CalendarMergedIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Calendar base */}
      <rect x="3" y="4" width="18" height="18" rx="2" />
      {/* Calendar hooks */}
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      {/* Header line */}
      <line x1="3" y1="10" x2="21" y2="10" />
      {/* Merged layers effect - overlapping squares */}
      <rect x="7" y="13" width="4" height="4" rx="0.5" strokeWidth="1.25" />
      <rect x="10" y="15" width="4" height="4" rx="0.5" strokeWidth="1.25" opacity="0.7" />
    </svg>
  );
}

function MapPinRouteIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Map pin */}
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 11 7 11s7-5.75 7-11c0-3.87-3.13-7-7-7z" />
      {/* Pin center dot */}
      <circle cx="12" cy="9" r="2.5" />
      {/* Route line indicator */}
      <path d="M12 20v2" strokeDasharray="2 2" />
      {/* Distance indicator dots */}
      <circle cx="6" cy="22" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="22" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SparkleAIIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Main sparkle */}
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
      {/* Center star burst */}
      <path d="M12 8l1.5 2.5L16 12l-2.5 1.5L12 16l-1.5-2.5L8 12l2.5-1.5L12 8z" />
      {/* Corner sparkles */}
      <path d="M5.5 5.5l1 1M17.5 5.5l-1 1M5.5 18.5l1-1M17.5 18.5l-1-1" strokeWidth="1.25" />
      {/* Small accent dots */}
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
