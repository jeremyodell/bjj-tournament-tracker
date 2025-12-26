import { ulid } from 'ulid';
import { getVenueByLookup, upsertVenue } from '../db/queries.js';
import { geocodeVenue } from './geocoder.js';
import type { NormalizedTournament } from '../fetchers/types.js';

export interface EnrichmentStats {
  cached: number;
  geocoded: number;
  failed: number;
  lowConfidence: number;
}

export async function enrichTournamentWithGeocode(
  tournament: NormalizedTournament
): Promise<NormalizedTournament> {
  const venueName = tournament.venue || tournament.city;
  const city = tournament.city;

  // Check cache first
  const cachedVenue = await getVenueByLookup(venueName, city);

  if (cachedVenue) {
    return {
      ...tournament,
      lat: cachedVenue.lat,
      lng: cachedVenue.lng,
      venueId: cachedVenue.venueId,
      geocodeConfidence: cachedVenue.geocodeConfidence,
    };
  }

  // Geocode the venue
  const geocodeResult = await geocodeVenue(venueName, city, tournament.country);

  if (!geocodeResult) {
    return {
      ...tournament,
      lat: null,
      lng: null,
      venueId: null,
      geocodeConfidence: 'failed',
    };
  }

  // Cache the result
  const venueId = ulid();
  const now = new Date().toISOString();

  await upsertVenue({
    venueId,
    name: venueName,
    city,
    country: tournament.country,
    lat: geocodeResult.lat,
    lng: geocodeResult.lng,
    geocodeConfidence: geocodeResult.confidence,
    manualOverride: false,
    createdAt: now,
    updatedAt: now,
  });

  return {
    ...tournament,
    lat: geocodeResult.lat,
    lng: geocodeResult.lng,
    venueId,
    geocodeConfidence: geocodeResult.confidence,
  };
}

export async function enrichTournamentsWithGeocode(
  tournaments: NormalizedTournament[]
): Promise<{ tournaments: NormalizedTournament[]; stats: EnrichmentStats }> {
  const stats: EnrichmentStats = {
    cached: 0,
    geocoded: 0,
    failed: 0,
    lowConfidence: 0,
  };

  const enriched: NormalizedTournament[] = [];

  for (const tournament of tournaments) {
    const venueName = tournament.venue || tournament.city;
    const cachedVenue = await getVenueByLookup(venueName, tournament.city);

    if (cachedVenue) {
      stats.cached++;
      enriched.push({
        ...tournament,
        lat: cachedVenue.lat,
        lng: cachedVenue.lng,
        venueId: cachedVenue.venueId,
        geocodeConfidence: cachedVenue.geocodeConfidence,
      });
    } else {
      const result = await enrichTournamentWithGeocode(tournament);
      enriched.push(result);

      if (result.geocodeConfidence === 'failed') {
        stats.failed++;
      } else {
        stats.geocoded++;
        if (result.geocodeConfidence === 'low') {
          stats.lowConfidence++;
        }
      }
    }
  }

  return { tournaments: enriched, stats };
}
