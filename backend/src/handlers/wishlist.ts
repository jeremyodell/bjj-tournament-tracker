import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { extractAuthContext } from './middleware/authMiddleware.js';
import {
  getUserWishlist,
  addToWishlist,
  removeFromWishlist,
  updateWishlistItem
} from '../db/wishlistQueries.js';
import { queryTournamentsByPKs } from '../db/queries.js';
import { ValidationError } from '../shared/errors.js';

const wishlistHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = extractAuthContext(event);
  const method = event.httpMethod;
  const tournamentId = event.pathParameters?.tournamentId;

  // GET /wishlist - list all wishlist items with tournament details
  if (method === 'GET' && !tournamentId) {
    const wishlistItems = await getUserWishlist(auth.userId);

    // Fetch tournament details for each wishlist item
    const tournamentPKs = wishlistItems.map(w => w.tournamentPK);
    const tournaments = await queryTournamentsByPKs(tournamentPKs);

    // Combine wishlist items with tournament details
    const result = wishlistItems.map(item => ({
      ...item,
      tournament: tournaments.find(t => t.PK === item.tournamentPK) || null,
    }));

    return jsonResponse(200, { wishlist: result });
  }

  // POST /wishlist - add tournament to wishlist
  if (method === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const { tournamentId: tid } = body;

    if (!tid) {
      throw new ValidationError('tournamentId is required');
    }

    const item = await addToWishlist(auth.userId, tid);
    return jsonResponse(201, item);
  }

  // PUT /wishlist/:tournamentId - update wishlist item
  if (method === 'PUT' && tournamentId) {
    const body = JSON.parse(event.body || '{}');
    const { status, athleteIds } = body;

    const updated = await updateWishlistItem(auth.userId, tournamentId, { status, athleteIds });
    if (!updated) {
      throw new ValidationError('Wishlist item not found');
    }
    return jsonResponse(200, updated);
  }

  // DELETE /wishlist/:tournamentId - remove from wishlist
  if (method === 'DELETE' && tournamentId) {
    await removeFromWishlist(auth.userId, tournamentId);
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

export const handler = withErrorHandler(wishlistHandler);
