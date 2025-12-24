import type { NormalizedTournament } from '../fetchers/types.js';

export async function upsertTournaments(
  tournaments: NormalizedTournament[]
): Promise<number> {
  // TODO: Implement DynamoDB batch write
  return tournaments.length;
}
