'use client';

/**
 * BeltWeaveBackground - Animated gold belt weave pattern for landing page hero
 *
 * Creates a subtle animated background with thin gold lines that weave and cross,
 * inspired by the intertwining patterns of BJJ belt fabric.
 *
 * Design spec requirements:
 * - Thin gold lines slowly weaving/crossing behind hero content
 * - Slow continuous weave motion using CSS animations
 * - Gold gradient: warm #d4af37 to cooler #c9a227 with soft glow
 * - 5-10% transparency for depth
 */

export function BeltWeaveBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Primary diagonal weave lines - moving right */}
      <div className="absolute inset-0">
        {/* Line 1 */}
        <div
          className="absolute w-[200%] h-[2px] opacity-[0.08]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #d4af37 20%, #c9a227 50%, #d4af37 80%, transparent 100%)',
            top: '15%',
            left: '-50%',
            animation: 'weave-right 25s linear infinite',
            boxShadow: '0 0 12px rgba(212, 175, 55, 0.3)',
          }}
        />
        {/* Line 2 */}
        <div
          className="absolute w-[200%] h-[1px] opacity-[0.06]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #c9a227 30%, #d4af37 70%, transparent 100%)',
            top: '35%',
            left: '-50%',
            animation: 'weave-right 30s linear infinite',
            animationDelay: '-5s',
            boxShadow: '0 0 8px rgba(201, 162, 39, 0.25)',
          }}
        />
        {/* Line 3 */}
        <div
          className="absolute w-[200%] h-[2px] opacity-[0.07]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #d4af37 25%, #c9a227 75%, transparent 100%)',
            top: '55%',
            left: '-50%',
            animation: 'weave-right 22s linear infinite',
            animationDelay: '-10s',
            boxShadow: '0 0 10px rgba(212, 175, 55, 0.3)',
          }}
        />
        {/* Line 4 */}
        <div
          className="absolute w-[200%] h-[1px] opacity-[0.05]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #c9a227 40%, #d4af37 60%, transparent 100%)',
            top: '75%',
            left: '-50%',
            animation: 'weave-right 28s linear infinite',
            animationDelay: '-15s',
            boxShadow: '0 0 6px rgba(201, 162, 39, 0.2)',
          }}
        />
      </div>

      {/* Secondary diagonal weave lines - moving left (crossing pattern) */}
      <div className="absolute inset-0">
        {/* Line 5 */}
        <div
          className="absolute w-[200%] h-[2px] opacity-[0.07]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #d4af37 30%, #c9a227 70%, transparent 100%)',
            top: '20%',
            right: '-50%',
            animation: 'weave-left 27s linear infinite',
            animationDelay: '-3s',
            boxShadow: '0 0 10px rgba(212, 175, 55, 0.25)',
          }}
        />
        {/* Line 6 */}
        <div
          className="absolute w-[200%] h-[1px] opacity-[0.06]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #c9a227 20%, #d4af37 80%, transparent 100%)',
            top: '45%',
            right: '-50%',
            animation: 'weave-left 24s linear infinite',
            animationDelay: '-8s',
            boxShadow: '0 0 8px rgba(201, 162, 39, 0.2)',
          }}
        />
        {/* Line 7 */}
        <div
          className="absolute w-[200%] h-[2px] opacity-[0.08]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #d4af37 35%, #c9a227 65%, transparent 100%)',
            top: '65%',
            right: '-50%',
            animation: 'weave-left 26s linear infinite',
            animationDelay: '-12s',
            boxShadow: '0 0 12px rgba(212, 175, 55, 0.3)',
          }}
        />
        {/* Line 8 */}
        <div
          className="absolute w-[200%] h-[1px] opacity-[0.05]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #c9a227 25%, #d4af37 75%, transparent 100%)',
            top: '85%',
            right: '-50%',
            animation: 'weave-left 32s linear infinite',
            animationDelay: '-18s',
            boxShadow: '0 0 6px rgba(201, 162, 39, 0.2)',
          }}
        />
      </div>

      {/* Horizontal accent lines for depth */}
      <div className="absolute inset-0">
        <div
          className="absolute w-[150%] h-[1px] opacity-[0.04]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #d4af37 50%, transparent 100%)',
            top: '30%',
            left: '-25%',
            animation: 'weave-pulse 15s ease-in-out infinite',
            boxShadow: '0 0 15px rgba(212, 175, 55, 0.15)',
          }}
        />
        <div
          className="absolute w-[150%] h-[1px] opacity-[0.04]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #c9a227 50%, transparent 100%)',
            top: '70%',
            left: '-25%',
            animation: 'weave-pulse 18s ease-in-out infinite',
            animationDelay: '-7s',
            boxShadow: '0 0 15px rgba(201, 162, 39, 0.15)',
          }}
        />
      </div>

      {/* Subtle gold glow overlay at intersections */}
      <div
        className="absolute w-[300px] h-[300px] rounded-full opacity-[0.03]"
        style={{
          background: 'radial-gradient(circle, #d4af37 0%, transparent 70%)',
          top: '20%',
          left: '30%',
          filter: 'blur(60px)',
          animation: 'glow-drift 20s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-[250px] h-[250px] rounded-full opacity-[0.025]"
        style={{
          background: 'radial-gradient(circle, #c9a227 0%, transparent 70%)',
          top: '60%',
          right: '25%',
          filter: 'blur(50px)',
          animation: 'glow-drift 25s ease-in-out infinite reverse',
        }}
      />
    </div>
  );
}
