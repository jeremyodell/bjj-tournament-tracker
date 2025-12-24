import { describe, it, expect } from '@jest/globals';
import {
  TournamentItem,
  UserProfileItem,
  AthleteItem,
  WishlistItem,
  buildTournamentPK,
  buildUserPK,
  buildAthleteSK,
  buildWishlistSK,
} from '../../db/types.js';

describe('DynamoDB key builders', () => {
  it('builds tournament PK correctly', () => {
    const pk = buildTournamentPK('IBJJF', 'ext123');
    expect(pk).toBe('TOURN#IBJJF#ext123');
  });

  it('builds user PK correctly', () => {
    const pk = buildUserPK('cognito-sub-123');
    expect(pk).toBe('USER#cognito-sub-123');
  });

  it('builds athlete SK correctly', () => {
    const sk = buildAthleteSK('01HQXYZ');
    expect(sk).toBe('ATHLETE#01HQXYZ');
  });

  it('builds wishlist SK correctly', () => {
    const sk = buildWishlistSK('TOURN#IBJJF#ext123');
    expect(sk).toBe('WISH#TOURN#IBJJF#ext123');
  });
});
