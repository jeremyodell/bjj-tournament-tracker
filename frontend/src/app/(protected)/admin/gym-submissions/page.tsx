'use client';

import { useState } from 'react';
import {
  useGymSubmissions,
  useApproveGymSubmission,
  useRejectGymSubmission,
} from '@/hooks/useGymSubmissions';

export default function GymSubmissionsPage() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const { data, isLoading, error } = useGymSubmissions(status);
  const approveSubmission = useApproveGymSubmission();
  const rejectSubmission = useRejectGymSubmission();

  const handleApprove = (submissionId: string, customGymName: string) => {
    const createNew = confirm(
      `Create new master gym for "${customGymName}"?\n\nClick OK to create new gym, or Cancel to link to existing gym.`
    );

    let masterGymId: string | undefined;
    if (!createNew) {
      masterGymId = prompt('Enter master gym ID to link to:') || undefined;
      if (!masterGymId) return;
    }

    approveSubmission.mutate({ submissionId, createNew, masterGymId });
  };

  const handleReject = (submissionId: string, customGymName: string) => {
    if (confirm(`Reject gym submission for "${customGymName}"?`)) {
      rejectSubmission.mutate(submissionId);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Gym Submissions</h1>

      {/* Status filter */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={() => setStatus('pending')}
          className={`px-4 py-2 rounded-md ${
            status === 'pending'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => setStatus('approved')}
          className={`px-4 py-2 rounded-md ${
            status === 'approved'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Approved
        </button>
        <button
          onClick={() => setStatus('rejected')}
          className={`px-4 py-2 rounded-md ${
            status === 'rejected'
              ? 'bg-red-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Rejected
        </button>
      </div>

      {/* Loading state */}
      {isLoading && <div className="text-center py-8">Loading submissions...</div>}

      {/* Error state */}
      {error && <div className="text-red-600 py-8">Error: {error.message}</div>}

      {/* Submissions list */}
      {data && (
        <div className="space-y-4">
          {data.submissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No submissions found</div>
          ) : (
            data.submissions.map((submission) => (
              <div
                key={submission.id}
                className="p-6 border border-gray-300 rounded-lg bg-white shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{submission.customGymName}</h3>

                    <div className="space-y-1 text-sm text-gray-600">
                      <p>
                        <strong>Submitted:</strong>{' '}
                        {new Date(submission.createdAt).toLocaleDateString()}
                      </p>
                      <p>
                        <strong>Athletes:</strong> {submission.athleteIds.length}
                      </p>
                      {submission.status === 'approved' && submission.masterGymId && (
                        <p>
                          <strong>Master Gym ID:</strong> {submission.masterGymId}
                        </p>
                      )}
                      {submission.reviewedAt && (
                        <p>
                          <strong>Reviewed:</strong>{' '}
                          {new Date(submission.reviewedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons (only for pending submissions) */}
                  {submission.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(submission.id, submission.customGymName)}
                        disabled={approveSubmission.isPending}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(submission.id, submission.customGymName)}
                        disabled={rejectSubmission.isPending}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {/* Status badge (for approved/rejected) */}
                  {submission.status !== 'pending' && (
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        submission.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
