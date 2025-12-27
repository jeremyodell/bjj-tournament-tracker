// frontend/src/lib/planGenerator.ts
import type { Tournament } from '@/lib/types';
import type { PlannerConfig, PlannedTournament } from '@/stores/plannerStore';

// Airport code to lat/lng mapping for common US airports
export const AIRPORT_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // Texas
  DFW: { lat: 32.8998, lng: -97.0403 },
  IAH: { lat: 29.9902, lng: -95.3368 },
  AUS: { lat: 30.1975, lng: -97.6664 },
  SAT: { lat: 29.5337, lng: -98.4698 },
  // California
  LAX: { lat: 33.9416, lng: -118.4085 },
  SFO: { lat: 37.6213, lng: -122.379 },
  SAN: { lat: 32.7338, lng: -117.1933 },
  SJC: { lat: 37.3626, lng: -121.929 },
  // East Coast
  JFK: { lat: 40.6413, lng: -73.7781 },
  EWR: { lat: 40.6895, lng: -74.1745 },
  BOS: { lat: 42.3656, lng: -71.0096 },
  PHL: { lat: 39.8729, lng: -75.2437 },
  DCA: { lat: 38.8512, lng: -77.0402 },
  IAD: { lat: 38.9531, lng: -77.4565 },
  // Southeast
  ATL: { lat: 33.6407, lng: -84.4277 },
  MIA: { lat: 25.7959, lng: -80.287 },
  MCO: { lat: 28.4312, lng: -81.308 },
  TPA: { lat: 27.9755, lng: -82.5332 },
  CLT: { lat: 35.214, lng: -80.9431 },
  // Midwest
  ORD: { lat: 41.9742, lng: -87.9073 },
  MDW: { lat: 41.786, lng: -87.7524 },
  DTW: { lat: 42.2124, lng: -83.3534 },
  MSP: { lat: 44.8848, lng: -93.2223 },
  // Southwest/Mountain
  PHX: { lat: 33.4373, lng: -112.0078 },
  DEN: { lat: 39.8561, lng: -104.6737 },
  LAS: { lat: 36.086, lng: -115.1537 },
  SEA: { lat: 47.4502, lng: -122.3088 },
  PDX: { lat: 45.5898, lng: -122.5951 },
  SLC: { lat: 40.7899, lng: -111.9791 },
};

// Haversine formula for distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Estimate driving time from distance (assuming 60mph average)
function estimateDriveHours(distanceMiles: number): number {
  return distanceMiles / 60;
}

// Estimate costs
function estimateRegistrationCost(tournament: Tournament): number {
  // TODO: Get actual registration costs from scraped data
  // For now, use estimates based on org
  return tournament.org === 'IBJJF' ? 120 : 80;
}

function estimateTravelCost(
  distanceMiles: number,
  travelType: 'drive' | 'fly'
): number {
  if (travelType === 'drive') {
    // IRS mileage rate ~$0.67/mile, round trip
    return Math.round(distanceMiles * 2 * 0.67);
  } else {
    // Rough flight estimate based on distance
    if (distanceMiles < 500) return 200;
    if (distanceMiles < 1000) return 350;
    if (distanceMiles < 2000) return 450;
    return 600;
  }
}

export interface GeneratePlanInput {
  config: PlannerConfig;
  allTournaments: Tournament[];
  homeLocation: { lat: number; lng: number };
}

export function generatePlan(input: GeneratePlanInput): PlannedTournament[] {
  const { config, allTournaments, homeLocation } = input;
  const availableBudget = config.totalBudget - config.reserveBudget;

  // Filter to future tournaments
  const now = new Date();
  const futureTournaments = allTournaments.filter(t => new Date(t.startDate) > now);

  // Calculate costs and travel type for each tournament
  const tournamentsWithCosts = futureTournaments.map(tournament => {
    let distanceMiles = 0;
    let hasCoordinates = true;

    if (tournament.lat && tournament.lng) {
      distanceMiles = calculateDistance(
        homeLocation.lat, homeLocation.lng,
        tournament.lat, tournament.lng
      );
    } else {
      // Default to a moderate distance for unknown locations
      // This prevents tournaments without coordinates from appearing as "local"
      distanceMiles = 500;
      hasCoordinates = false;
    }

    const driveHours = estimateDriveHours(distanceMiles);
    // If no coordinates, default to flying since we can't determine if drivable
    const travelType: 'drive' | 'fly' = hasCoordinates && driveHours <= config.maxDriveHours ? 'drive' : 'fly';
    const registrationCost = estimateRegistrationCost(tournament);
    const travelCost = estimateTravelCost(distanceMiles, travelType);
    const totalCost = registrationCost + travelCost;

    return {
      tournament,
      registrationCost,
      travelCost,
      travelType,
      totalCost,
      distanceMiles,
      hasCoordinates,
      isLocked: config.mustGoTournaments.includes(tournament.id),
    };
  });

  // Start with must-go tournaments
  const plan: PlannedTournament[] = [];
  let remainingBudget = availableBudget;

  // Add must-go tournaments first
  for (const t of tournamentsWithCosts.filter(t => t.isLocked)) {
    plan.push({
      tournament: t.tournament,
      registrationCost: t.registrationCost,
      travelCost: t.travelCost,
      travelType: t.travelType,
      isLocked: true,
    });
    remainingBudget -= t.totalCost;
  }

  // Sort remaining by value (prefer cheaper, closer, preferred org)
  const remaining = tournamentsWithCosts
    .filter(t => !t.isLocked)
    .sort((a, b) => {
      // Apply org preference
      let scoreA = a.totalCost;
      let scoreB = b.totalCost;

      if (config.orgPreference === 'ibjjf') {
        if (a.tournament.org === 'IBJJF') scoreA *= 0.8;
        if (b.tournament.org === 'IBJJF') scoreB *= 0.8;
      } else if (config.orgPreference === 'jjwl') {
        if (a.tournament.org === 'JJWL') scoreA *= 0.8;
        if (b.tournament.org === 'JJWL') scoreB *= 0.8;
      }

      return scoreA - scoreB;
    });

  // Greedily add tournaments within budget and schedule constraints
  const monthCounts: Record<string, number> = {};

  for (const p of plan) {
    const month = p.tournament.startDate.substring(0, 7);
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  }

  for (const t of remaining) {
    if (t.totalCost > remainingBudget) continue;

    const month = t.tournament.startDate.substring(0, 7);
    if ((monthCounts[month] || 0) >= config.tournamentsPerMonth) continue;

    plan.push({
      tournament: t.tournament,
      registrationCost: t.registrationCost,
      travelCost: t.travelCost,
      travelType: t.travelType,
      isLocked: false,
    });

    remainingBudget -= t.totalCost;
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  }

  // Sort by date
  return plan.sort((a, b) =>
    new Date(a.tournament.startDate).getTime() - new Date(b.tournament.startDate).getTime()
  );
}

// Helper function to get home location from airport code
export function getHomeLocationFromAirport(airportCode: string): { lat: number; lng: number } | null {
  const code = airportCode.toUpperCase().trim();
  return AIRPORT_COORDINATES[code] || null;
}
