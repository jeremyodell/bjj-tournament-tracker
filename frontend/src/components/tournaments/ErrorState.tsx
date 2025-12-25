'use client';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      className="rounded-2xl border p-8"
      style={{
        background: 'rgba(255, 45, 106, 0.05)',
        borderColor: 'rgba(255, 45, 106, 0.2)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div className="flex flex-col items-center justify-center text-center">
        {/* Error icon with magenta accent */}
        <div className="rounded-full p-4 mb-4" style={{ background: 'rgba(255, 45, 106, 0.1)' }}>
          <svg
            className="h-8 w-8 text-[#FF2D6A]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h3 className="text-xl font-semibold text-[#FF2D6A] mb-2">{title}</h3>
        <p className="text-sm text-white/60 mb-6 max-w-md">{message}</p>

        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
            style={{
              background: 'rgba(255, 45, 106, 0.2)',
              color: '#FF2D6A',
              border: '1px solid rgba(255, 45, 106, 0.3)',
            }}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title = 'No tournaments found',
  message = 'Try adjusting your filters or search criteria.',
  action,
}: EmptyStateProps) {
  return (
    <div
      className="rounded-2xl border border-dashed p-8"
      style={{
        background: 'var(--glass-bg)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div className="flex flex-col items-center justify-center text-center">
        {/* Search icon with cyan accent */}
        <div className="rounded-full p-4 mb-4" style={{ background: 'rgba(0, 240, 255, 0.1)' }}>
          <svg
            className="h-8 w-8 text-[#00F0FF]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/60 mb-6 max-w-md">{message}</p>

        {action && (
          <button
            onClick={action.onClick}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
            style={{
              background: 'rgba(0, 240, 255, 0.2)',
              color: '#00F0FF',
              border: '1px solid rgba(0, 240, 255, 0.3)',
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
