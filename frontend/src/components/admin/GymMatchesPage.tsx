// frontend/src/components/admin/GymMatchesPage.tsx
'use client';

import { useState } from 'react';
import { useAdminMatches, useApproveMatch, useRejectMatch, type PendingMatch } from '@/hooks/useAdminMatches';

type StatusFilter = 'pending' | 'approved' | 'rejected';

function MatchCard({ match, onApprove, onReject, isPending }: {
  match: PendingMatch;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
}) {
  const confidenceColor = match.confidence >= 90 ? '#22c55e' :
                          match.confidence >= 80 ? '#84cc16' :
                          match.confidence >= 70 ? '#eab308' : '#ef4444';

  return (
    <div
      className="p-4 rounded-xl border"
      style={{
        background: 'var(--glass-bg)',
        borderColor: 'var(--glass-border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Header with confidence score */}
      <div className="flex items-center justify-between mb-3">
        <div
          className="px-3 py-1 rounded-full text-sm font-semibold"
          style={{ backgroundColor: `${confidenceColor}20`, color: confidenceColor }}
        >
          {match.confidence}% Match
        </div>
        <span className="text-xs opacity-50">
          {new Date(match.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Gym names comparison */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">JJWL</span>
          <span className="font-medium">{match.sourceGym1Name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">IBJJF</span>
          <span className="font-medium">{match.sourceGym2Name}</span>
        </div>
      </div>

      {/* Match signals breakdown */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
        <div className="text-center p-2 rounded bg-white/5">
          <div className="opacity-50">Name</div>
          <div className="font-semibold">{match.signals.nameSimilarity}%</div>
        </div>
        <div className="text-center p-2 rounded bg-white/5">
          <div className="opacity-50">City</div>
          <div className="font-semibold">+{match.signals.cityBoost}</div>
        </div>
        <div className="text-center p-2 rounded bg-white/5">
          <div className="opacity-50">Affil.</div>
          <div className="font-semibold">+{match.signals.affiliationBoost}</div>
        </div>
      </div>

      {/* Action buttons - only show for pending matches */}
      {match.status === 'pending' && (
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            disabled={isPending}
            className="flex-1 py-2 px-4 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 transition-colors font-medium text-sm"
          >
            {isPending ? 'Processing...' : 'Approve'}
          </button>
          <button
            onClick={onReject}
            disabled={isPending}
            className="flex-1 py-2 px-4 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 disabled:opacity-50 transition-colors font-medium text-sm"
          >
            Reject
          </button>
        </div>
      )}

      {/* Status badge for reviewed matches */}
      {match.status !== 'pending' && (
        <div className={`text-center py-2 rounded-lg text-sm font-medium ${
          match.status === 'approved' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
        }`}>
          {match.status === 'approved' ? 'Approved' : 'Rejected'}
          {match.reviewedAt && (
            <span className="opacity-50 ml-2">
              on {new Date(match.reviewedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function GymMatchesPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const { data, isLoading, error } = useAdminMatches(statusFilter);
  const approveMutation = useApproveMatch();
  const rejectMutation = useRejectMatch();

  const handleApprove = (matchId: string) => {
    approveMutation.mutate(matchId);
  };

  const handleReject = (matchId: string) => {
    if (confirm('Are you sure you want to reject this match?')) {
      rejectMutation.mutate(matchId);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Gym Match Review</h1>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'rejected'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              statusFilter === status
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12 opacity-50">
          Loading matches...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-center py-12 text-red-400">
          Failed to load matches: {error.message}
        </div>
      )}

      {/* Empty state */}
      {data?.matches.length === 0 && !isLoading && (
        <div className="text-center py-12 opacity-50">
          No {statusFilter} matches found.
        </div>
      )}

      {/* Match list */}
      <div className="grid gap-4">
        {data?.matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            onApprove={() => handleApprove(match.id)}
            onReject={() => handleReject(match.id)}
            isPending={approveMutation.isPending || rejectMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}
