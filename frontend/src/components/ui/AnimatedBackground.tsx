'use client';

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base navy background - ensures consistency */}
      <div className="absolute inset-0 bg-[#0A1128]" />

      {/* Subtle vignette overlay for depth */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.6) 100%)',
        }}
      />

      {/* Cyan orb - top left area */}
      <div
        className="absolute w-[700px] h-[700px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, #00F0FF 0%, transparent 70%)',
          filter: 'blur(120px)',
          top: '-10%',
          left: '-8%',
          animation: 'float-1 20s ease-in-out infinite',
        }}
      />

      {/* Magenta orb - top right area */}
      <div
        className="absolute w-[750px] h-[750px] rounded-full opacity-18"
        style={{
          background: 'radial-gradient(circle, #FF2D6A 0%, transparent 70%)',
          filter: 'blur(130px)',
          top: '-8%',
          right: '-12%',
          animation: 'float-2 22s ease-in-out infinite',
        }}
      />

      {/* Yellow/Gold orb - center area for tournament theme */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-12"
        style={{
          background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)',
          filter: 'blur(140px)',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          animation: 'float-3 25s ease-in-out infinite',
        }}
      />

      {/* Cyan orb - bottom right area */}
      <div
        className="absolute w-[680px] h-[680px] rounded-full opacity-22"
        style={{
          background: 'radial-gradient(circle, #00F0FF 0%, transparent 70%)',
          filter: 'blur(115px)',
          bottom: '-18%',
          right: '3%',
          animation: 'float-1 18s ease-in-out infinite reverse',
        }}
      />

      {/* Magenta orb - bottom left area */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-25"
        style={{
          background: 'radial-gradient(circle, #FF2D6A 0%, transparent 70%)',
          filter: 'blur(105px)',
          bottom: '-12%',
          left: '8%',
          animation: 'float-2 16s ease-in-out infinite reverse',
        }}
      />

      {/* Subtle grid overlay for digital scoreboard feel */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 215, 0, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 215, 0, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
    </div>
  );
}
