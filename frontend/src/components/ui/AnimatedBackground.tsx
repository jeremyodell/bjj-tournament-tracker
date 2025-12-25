'use client';

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Cyan orb - top left area */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, #00F0FF 0%, transparent 70%)',
          filter: 'blur(100px)',
          top: '-10%',
          left: '-5%',
          animation: 'float-1 18s ease-in-out infinite',
        }}
      />

      {/* Magenta orb - top right area */}
      <div
        className="absolute w-[700px] h-[700px] rounded-full opacity-15"
        style={{
          background: 'radial-gradient(circle, #FF2D6A 0%, transparent 70%)',
          filter: 'blur(120px)',
          top: '-5%',
          right: '-10%',
          animation: 'float-2 20s ease-in-out infinite',
        }}
      />

      {/* Cyan orb - bottom right area */}
      <div
        className="absolute w-[650px] h-[650px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, #00F0FF 0%, transparent 70%)',
          filter: 'blur(110px)',
          bottom: '-15%',
          right: '5%',
          animation: 'float-3 16s ease-in-out infinite',
        }}
      />

      {/* Magenta orb - bottom left area */}
      <div
        className="absolute w-[550px] h-[550px] rounded-full opacity-25"
        style={{
          background: 'radial-gradient(circle, #FF2D6A 0%, transparent 70%)',
          filter: 'blur(100px)',
          bottom: '-10%',
          left: '10%',
          animation: 'float-1 15s ease-in-out infinite reverse',
        }}
      />
    </div>
  );
}
