import { getAmadeusClient } from './amadeusClient.js';
import { saveFlightPrice, getFlightPrice } from '../db/flightPriceQueries.js';
import type { TournamentItem } from '../db/types.js';

export interface Location {
  lat: number;
  lng: number;
  city: string;
}

/**
 * Haversine formula for calculating great-circle distance between two points
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate smart TTL based on tournament proximity
 * - < 30 days: 24 hour cache (prices change frequently)
 * - 30-90 days: 3 day cache
 * - > 90 days: 7 day cache (prices are more stable)
 */
export function calculateSmartTTL(tournamentDate: Date): Date {
  const now = new Date();
  const daysUntil = Math.floor(
    (tournamentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntil < 30) {
    // 24 hour cache
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  } else if (daysUntil < 90) {
    // 3 day cache
    return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  } else {
    // 7 day cache
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Determine if we should fetch flight price for a tournament
 * based on user's max drive hours preference
 */
export function shouldFetchFlightPrice(
  homeAirport: Location,
  tournament: Location,
  maxDriveHours: number
): boolean {
  // User only flies - skip same city only
  if (maxDriveHours === 0) {
    return tournament.city.toLowerCase() !== homeAirport.city.toLowerCase();
  }

  const distance = calculateDistance(
    homeAirport.lat,
    homeAirport.lng,
    tournament.lat,
    tournament.lng
  );

  // Assume 60 mph average speed for drive time estimate
  const driveHours = distance / 60;

  return driveHours > maxDriveHours;
}

/**
 * Fetch and cache flight price for a specific tournament
 * @param originAirport IATA code of origin airport
 * @param originLocation Lat/lng/city of origin
 * @param destinationAirportCode IATA code of destination airport
 * @param tournament Tournament to fetch price for
 * @param maxDriveHours User's max drive hours preference
 */
export async function fetchFlightPriceForTournament(
  originAirport: string,
  originLocation: Location,
  destinationAirportCode: string,
  tournament: TournamentItem,
  maxDriveHours: number
): Promise<void> {
  // Check if tournament has coordinates
  if (!tournament.lat || !tournament.lng) {
    console.log(`Skipping ${tournament.name}: no coordinates`);
    return;
  }

  const tournamentLocation: Location = {
    lat: tournament.lat,
    lng: tournament.lng,
    city: tournament.city,
  };

  // Check if within drive range
  if (!shouldFetchFlightPrice(originLocation, tournamentLocation, maxDriveHours)) {
    console.log(`Skipping ${tournament.name}: within drive range`);
    return;
  }

  // Check cache
  const cached = await getFlightPrice(originAirport, tournament.city, tournament.startDate);
  if (cached && new Date(cached.expiresAt) > new Date()) {
    console.log(`Using cached price for ${originAirport} -> ${tournament.city}`);
    return;
  }

  // Calculate flight dates (day before start, day after end)
  const startDate = new Date(tournament.startDate);
  const endDate = new Date(tournament.endDate);
  const departureDate = new Date(startDate);
  departureDate.setDate(departureDate.getDate() - 1);
  const returnDate = new Date(endDate);
  returnDate.setDate(returnDate.getDate() + 1);

  // Format dates as YYYY-MM-DD
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  // Fetch from Amadeus
  const client = getAmadeusClient();
  let result;
  try {
    result = await client.searchFlights({
      origin: originAirport,
      destination: destinationAirportCode,
      departureDate: formatDate(departureDate),
      returnDate: formatDate(returnDate),
    });
  } catch (error) {
    console.error(`Amadeus API error for ${originAirport} -> ${destinationAirportCode}:`, error);
    result = null;
  }

  const expiry = calculateSmartTTL(startDate);

  if (result) {
    await saveFlightPrice({
      originAirport,
      destinationCity: tournament.city,
      tournamentStartDate: tournament.startDate,
      price: result.price,
      currency: 'USD',
      airline: result.airline,
      fetchedAt: new Date().toISOString(),
      expiresAt: expiry.toISOString(),
      source: 'amadeus',
      rangeMin: null,
      rangeMax: null,
    });
    console.log(`Saved price: ${originAirport} -> ${tournament.city} = $${result.price}`);
  } else {
    // Store as null price - indicates fetch attempted but no result
    // This prevents repeated failed lookups
    await saveFlightPrice({
      originAirport,
      destinationCity: tournament.city,
      tournamentStartDate: tournament.startDate,
      price: null,
      currency: 'USD',
      airline: null,
      fetchedAt: new Date().toISOString(),
      expiresAt: expiry.toISOString(),
      source: 'estimated_range',
      rangeMin: null,
      rangeMax: null,
    });
    console.log(`No price found: ${originAirport} -> ${tournament.city}`);
  }
}

/**
 * Estimate drive cost based on IRS mileage rate
 * @param distanceMiles One-way distance in miles
 * @returns Round-trip drive cost
 */
export function estimateDriveCost(distanceMiles: number): number {
  const IRS_MILEAGE_RATE = 0.67; // 2024 IRS mileage rate
  return Math.round(distanceMiles * 2 * IRS_MILEAGE_RATE);
}

/**
 * Get travel recommendation (drive vs fly) for a tournament
 */
export function getTravelRecommendation(
  driveDistance: number,
  flightPrice: number | null,
  maxDriveHours: number
): 'drive' | 'fly' {
  const driveHours = driveDistance / 60;
  const driveCost = estimateDriveCost(driveDistance);

  // If within drive range preference, recommend drive
  if (driveHours <= maxDriveHours) {
    return 'drive';
  }

  // If no flight price, default to fly (assume it's cheaper for long distances)
  if (flightPrice === null) {
    return 'fly';
  }

  // Compare costs - flying wins if cheaper, otherwise drive if within reason
  if (flightPrice < driveCost && driveHours > 4) {
    return 'fly';
  }

  // For moderate distances, prefer drive if cost-effective
  if (driveHours <= 8 && driveCost < flightPrice * 1.5) {
    return 'drive';
  }

  return 'fly';
}
