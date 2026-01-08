import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { extractAuthContext } from './middleware/authMiddleware.js';
import {
  getGymSubmission,
  listGymSubmissions,
  updateGymSubmissionStatus,
  linkGymSubmissionToMaster,
} from '../db/gymSubmissionQueries.js';
import { createMasterGym, getMasterGym } from '../db/masterGymQueries.js';
import { ValidationError, NotFoundError } from '../shared/errors.js';

const adminGymSubmissionsHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const auth = extractAuthContext(event);
  const method = event.httpMethod;
  const path = event.path;

  // GET /admin/gym-submissions - list gym submissions by status
  if (method === 'GET' && path.includes('/gym-submissions')) {
    const status = (event.queryStringParameters?.status || 'pending') as
      | 'pending'
      | 'approved'
      | 'rejected';

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      throw new ValidationError('Invalid status. Must be pending, approved, or rejected');
    }

    const submissions = await listGymSubmissions(status);

    return jsonResponse(200, {
      submissions: submissions.map((s) => ({
        id: s.id,
        customGymName: s.customGymName,
        submittedByUserId: s.submittedByUserId,
        athleteIds: s.athleteIds,
        status: s.status,
        masterGymId: s.masterGymId,
        createdAt: s.createdAt,
        reviewedAt: s.reviewedAt,
        reviewedBy: s.reviewedBy,
      })),
    });
  }

  // POST /admin/gym-submissions/{id}/approve
  if (method === 'POST' && path.includes('/approve')) {
    const submissionId = event.pathParameters?.id;
    if (!submissionId) {
      throw new ValidationError('Submission ID is required');
    }

    const submission = await getGymSubmission(submissionId);
    if (!submission) {
      throw new NotFoundError('Gym submission not found');
    }

    if (submission.status !== 'pending') {
      throw new ValidationError('Submission has already been reviewed');
    }

    const body = JSON.parse(event.body || '{}');
    const { masterGymId, createNew } = body;

    let finalMasterGymId: string;

    if (createNew) {
      // Create new master gym
      const masterGym = await createMasterGym({
        canonicalName: submission.customGymName,
        city: null,
        country: null,
      });
      finalMasterGymId = masterGym.id;
    } else if (masterGymId) {
      // Link to existing master gym
      const masterGym = await getMasterGym(masterGymId);
      if (!masterGym) {
        throw new NotFoundError('Master gym not found');
      }
      finalMasterGymId = masterGymId;
    } else {
      throw new ValidationError('Either masterGymId or createNew must be provided');
    }

    // Link submission to master gym
    await linkGymSubmissionToMaster(submissionId, finalMasterGymId);

    // Update submission status
    await updateGymSubmissionStatus(submissionId, 'approved', auth.userId);

    return jsonResponse(200, {
      masterGymId: finalMasterGymId,
      message: 'Gym submission approved',
    });
  }

  // POST /admin/gym-submissions/{id}/reject
  if (method === 'POST' && path.includes('/reject')) {
    const submissionId = event.pathParameters?.id;
    if (!submissionId) {
      throw new ValidationError('Submission ID is required');
    }

    const submission = await getGymSubmission(submissionId);
    if (!submission) {
      throw new NotFoundError('Gym submission not found');
    }

    if (submission.status !== 'pending') {
      throw new ValidationError('Submission has already been reviewed');
    }

    await updateGymSubmissionStatus(submissionId, 'rejected', auth.userId);

    return jsonResponse(200, {
      message: 'Gym submission rejected',
    });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

export const handler = withErrorHandler(adminGymSubmissionsHandler);
