'use client';

import Link from 'next/link';

export function ScoreboardHero() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* LED Status Bar */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--led-green)', boxShadow: '0 0 8px var(--led-green)' }} />
              <span
                className="text-xs font-bold tracking-widest uppercase"
                style={{
                  fontFamily: 'var(--font-mono-display)',
                  color: 'var(--scoreboard-white)',
                }}
              >
                LIVE FEED
              </span>
            </div>
          </div>

          {/* Main Headline - LED Display Style */}
          <h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight"
            style={{
              fontFamily: 'var(--font-mono-display)',
              background: 'linear-gradient(135deg, var(--scoreboard-yellow) 0%, var(--scoreboard-white) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 0 40px var(--scoreboard-yellow-glow)',
            }}
          >
            FIND YOUR
            <br />
            NEXT MATCH
          </h1>

          {/* Subheadline */}
          <p
            className="text-lg sm:text-xl mb-8 max-w-2xl mx-auto leading-relaxed"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            Track IBJJF and JJWL tournaments. See who from your gym is competing. Plan your season.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <a
              href="#tournaments"
              className="group w-full sm:w-auto px-8 py-4 rounded text-base font-bold tracking-wide transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2"
              style={{
                fontFamily: 'var(--font-mono-display)',
                background: 'var(--scoreboard-yellow)',
                color: '#000',
                boxShadow: '0 0 30px var(--scoreboard-yellow-glow)',
              }}
            >
              <span>BROWSE TOURNAMENTS</span>
              <svg
                className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </a>

            <Link
              href="/plan"
              className="w-full sm:w-auto px-8 py-4 rounded text-base font-bold tracking-wide transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2"
              style={{
                fontFamily: 'var(--font-mono-display)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--scoreboard-white)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <span>PLAN YOUR SEASON</span>
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </Link>
          </div>

          {/* Stats Display - Scoreboard Style */}
          <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { label: 'TOURNAMENTS', value: '150+' },
              { label: 'ORGS TRACKED', value: '2' },
              { label: 'ACTIVE USERS', value: '1.2K' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-4 rounded"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div
                  className="text-3xl sm:text-4xl font-bold mb-1 tabular-nums"
                  style={{
                    fontFamily: 'var(--font-mono-display)',
                    color: 'var(--scoreboard-yellow)',
                    textShadow: '0 0 12px var(--scoreboard-yellow-glow)',
                  }}
                >
                  {stat.value}
                </div>
                <div
                  className="text-[10px] sm:text-xs font-semibold tracking-widest uppercase opacity-60"
                  style={{
                    fontFamily: 'var(--font-mono-display)',
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
