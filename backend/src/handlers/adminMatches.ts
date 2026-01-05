import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { extractAuthContext } from './middleware/authMiddleware.js';
import {
  getPendingMatch,
  listPendingMatches,
  updatePendingMatchStatus,
} from '../db/pendingMatchQueries.js';
import {
  createMasterGym,
  getMasterGym,
  linkSourceGymToMaster,
  unlinkSourceGymFromMaster,
} from '../db/masterGymQueries.js';
import { getSourceGym } from '../db/gymQueries.js';
import { ValidationError, NotFoundError } from '../shared/errors.js';

// Parse source gym ID to extract org and externalId
function parseSourceGymId(id: string): { org: 'JJWL' | 'IBJJF'; externalId: string } | null {
  const match = id.match(/^SRCGYM#(JJWL|IBJJF)#(.+)$/);
  if (!match) return null;
  return { org: match[1] as 'JJWL' | 'IBJJF', externalId: match[2] };
}

const adminMatchesHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = extractAuthContext(event);
  const method = event.httpMethod;
  const path = event.path;

  // GET /admin/pending-matches - list pending matches
  if (method === 'GET' && path.includes('/pending-matches')) {
    const status = (event.queryStringParameters?.status || 'pending') as 'pending' | 'approved' | 'rejected';

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      throw new ValidationError('Invalid status. Must be pending, approved, or rejected');
    }

    const matches = await listPendingMatches(status);

    return jsonResponse(200, {
      matches: matches.map((m) => ({
        id: m.id,
        sourceGym1Id: m.sourceGym1Id,
        sourceGym1Name: m.sourceGym1Name,
        sourceGym2Id: m.sourceGym2Id,
        sourceGym2Name: m.sourceGym2Name,
        confidence: m.confidence,
        signals: m.signals,
        status: m.status,
        createdAt: m.createdAt,
        reviewedAt: m.reviewedAt,
        reviewedBy: m.reviewedBy,
      })),
    });
  }

  // POST /admin/pending-matches/{id}/approve
  if (method === 'POST' && path.includes('/approve')) {
    const matchId = event.pathParameters?.id;
    if (!matchId) {
      throw new ValidationError('Match ID is required');
    }

    const match = await getPendingMatch(matchId);
    if (!match) {
      throw new NotFoundError('Pending match not found');
    }

    if (match.status !== 'pending') {
      throw new ValidationError('Match has already been reviewed');
    }

    // Parse source gym IDs
    const gym1Parsed = parseSourceGymId(match.sourceGym1Id);
    const gym2Parsed = parseSourceGymId(match.sourceGym2Id);

    if (!gym1Parsed || !gym2Parsed) {
      throw new ValidationError('Invalid source gym IDs in match');
    }

    // Get source gyms for additional data
    const gym1 = await getSourceGym(gym1Parsed.org, gym1Parsed.externalId);
    const gym2 = await getSourceGym(gym2Parsed.org, gym2Parsed.externalId);

    // Create master gym (use first gym's name as canonical)
    const masterGym = await createMasterGym({
      canonicalName: match.sourceGym1Name,
      city: gym1?.city || gym2?.city,
      country: gym1?.country || gym2?.country,
    });

    // Link both source gyms
    await linkSourceGymToMaster(gym1Parsed.org, gym1Parsed.externalId, masterGym.id);
    await linkSourceGymToMaster(gym2Parsed.org, gym2Parsed.externalId, masterGym.id);

    // Update match status
    await updatePendingMatchStatus(matchId, 'approved', auth.userId);

    return jsonResponse(200, {
      masterGymId: masterGym.id,
      message: 'Match approved and gyms linked',
    });
  }

  // POST /admin/pending-matches/{id}/reject
  if (method === 'POST' && path.includes('/reject')) {
    const matchId = event.pathParameters?.id;
    if (!matchId) {
      throw new ValidationError('Match ID is required');
    }

    const match = await getPendingMatch(matchId);
    if (!match) {
      throw new NotFoundError('Pending match not found');
    }

    if (match.status !== 'pending') {
      throw new ValidationError('Match has already been reviewed');
    }

    await updatePendingMatchStatus(matchId, 'rejected', auth.userId);

    return jsonResponse(200, {
      message: 'Match rejected',
    });
  }

  // POST /admin/master-gyms/{id}/unlink
  if (method === 'POST' && path.includes('/master-gyms') && path.includes('/unlink')) {
    const masterGymId = event.pathParameters?.id;
    if (!masterGymId) {
      throw new ValidationError('Master gym ID is required');
    }

    const body = JSON.parse(event.body || '{}');
    const { sourceGymId } = body;

    if (!sourceGymId) {
      throw new ValidationError('sourceGymId is required in request body');
    }

    // Verify master gym exists
    const masterGym = await getMasterGym(masterGymId);
    if (!masterGym) {
      throw new NotFoundError('Master gym not found');
    }

    // Parse and unlink source gym
    const parsed = parseSourceGymId(sourceGymId);
    if (!parsed) {
      throw new ValidationError('Invalid sourceGymId format');
    }

    await unlinkSourceGymFromMaster(parsed.org, parsed.externalId);

    return jsonResponse(200, {
      message: 'Source gym unlinked from master',
    });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

export const handler = withErrorHandler(adminMatchesHandler);
