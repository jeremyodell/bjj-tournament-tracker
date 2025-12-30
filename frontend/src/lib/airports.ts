/**
 * Static airport data for flight price lookups
 * Based on OpenFlights data, filtered to major US airports
 */

export interface Airport {
  iataCode: string;
  name: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
}

// Major US airports - can be expanded as needed
const AIRPORTS: Airport[] = [
  // Texas
  { iataCode: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', state: 'TX', country: 'US', lat: 32.8998, lng: -97.0403 },
  { iataCode: 'IAH', name: 'George Bush Intercontinental Airport', city: 'Houston', state: 'TX', country: 'US', lat: 29.9902, lng: -95.3368 },
  { iataCode: 'HOU', name: 'William P. Hobby Airport', city: 'Houston', state: 'TX', country: 'US', lat: 29.6454, lng: -95.2789 },
  { iataCode: 'SAT', name: 'San Antonio International Airport', city: 'San Antonio', state: 'TX', country: 'US', lat: 29.5337, lng: -98.4698 },
  { iataCode: 'AUS', name: 'Austin-Bergstrom International Airport', city: 'Austin', state: 'TX', country: 'US', lat: 30.1945, lng: -97.6699 },

  // California
  { iataCode: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', state: 'CA', country: 'US', lat: 33.9425, lng: -118.4081 },
  { iataCode: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', state: 'CA', country: 'US', lat: 37.6213, lng: -122.3790 },
  { iataCode: 'SAN', name: 'San Diego International Airport', city: 'San Diego', state: 'CA', country: 'US', lat: 32.7336, lng: -117.1897 },
  { iataCode: 'SJC', name: 'Norman Y. Mineta San Jose International Airport', city: 'San Jose', state: 'CA', country: 'US', lat: 37.3639, lng: -121.9289 },
  { iataCode: 'OAK', name: 'Oakland International Airport', city: 'Oakland', state: 'CA', country: 'US', lat: 37.7213, lng: -122.2208 },

  // Florida
  { iataCode: 'MIA', name: 'Miami International Airport', city: 'Miami', state: 'FL', country: 'US', lat: 25.7959, lng: -80.2870 },
  { iataCode: 'MCO', name: 'Orlando International Airport', city: 'Orlando', state: 'FL', country: 'US', lat: 28.4312, lng: -81.3081 },
  { iataCode: 'TPA', name: 'Tampa International Airport', city: 'Tampa', state: 'FL', country: 'US', lat: 27.9755, lng: -82.5332 },
  { iataCode: 'FLL', name: 'Fort Lauderdale-Hollywood International Airport', city: 'Fort Lauderdale', state: 'FL', country: 'US', lat: 26.0726, lng: -80.1527 },
  { iataCode: 'JAX', name: 'Jacksonville International Airport', city: 'Jacksonville', state: 'FL', country: 'US', lat: 30.4941, lng: -81.6879 },

  // Nevada
  { iataCode: 'LAS', name: 'Harry Reid International Airport', city: 'Las Vegas', state: 'NV', country: 'US', lat: 36.0840, lng: -115.1537 },

  // Arizona
  { iataCode: 'PHX', name: 'Phoenix Sky Harbor International Airport', city: 'Phoenix', state: 'AZ', country: 'US', lat: 33.4373, lng: -112.0078 },

  // Georgia
  { iataCode: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', state: 'GA', country: 'US', lat: 33.6407, lng: -84.4277 },

  // Colorado
  { iataCode: 'DEN', name: 'Denver International Airport', city: 'Denver', state: 'CO', country: 'US', lat: 39.8561, lng: -104.6737 },

  // New York
  { iataCode: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', state: 'NY', country: 'US', lat: 40.6413, lng: -73.7781 },
  { iataCode: 'LGA', name: 'LaGuardia Airport', city: 'New York', state: 'NY', country: 'US', lat: 40.7769, lng: -73.8740 },
  { iataCode: 'EWR', name: 'Newark Liberty International Airport', city: 'Newark', state: 'NJ', country: 'US', lat: 40.6895, lng: -74.1745 },

  // Illinois
  { iataCode: 'ORD', name: "O'Hare International Airport", city: 'Chicago', state: 'IL', country: 'US', lat: 41.9742, lng: -87.9073 },
  { iataCode: 'MDW', name: 'Chicago Midway International Airport', city: 'Chicago', state: 'IL', country: 'US', lat: 41.7868, lng: -87.7522 },

  // Washington
  { iataCode: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', state: 'WA', country: 'US', lat: 47.4502, lng: -122.3088 },

  // Massachusetts
  { iataCode: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', state: 'MA', country: 'US', lat: 42.3656, lng: -71.0096 },

  // North Carolina
  { iataCode: 'CLT', name: 'Charlotte Douglas International Airport', city: 'Charlotte', state: 'NC', country: 'US', lat: 35.2140, lng: -80.9431 },
  { iataCode: 'RDU', name: 'Raleigh-Durham International Airport', city: 'Raleigh', state: 'NC', country: 'US', lat: 35.8776, lng: -78.7875 },

  // Michigan
  { iataCode: 'DTW', name: 'Detroit Metropolitan Wayne County Airport', city: 'Detroit', state: 'MI', country: 'US', lat: 42.2124, lng: -83.3534 },

  // Minnesota
  { iataCode: 'MSP', name: 'Minneapolis-Saint Paul International Airport', city: 'Minneapolis', state: 'MN', country: 'US', lat: 44.8820, lng: -93.2218 },

  // Maryland
  { iataCode: 'BWI', name: 'Baltimore/Washington International Airport', city: 'Baltimore', state: 'MD', country: 'US', lat: 39.1754, lng: -76.6683 },

  // Virginia
  { iataCode: 'DCA', name: 'Ronald Reagan Washington National Airport', city: 'Washington', state: 'DC', country: 'US', lat: 38.8512, lng: -77.0402 },
  { iataCode: 'IAD', name: 'Washington Dulles International Airport', city: 'Washington', state: 'VA', country: 'US', lat: 38.9531, lng: -77.4565 },

  // Pennsylvania
  { iataCode: 'PHL', name: 'Philadelphia International Airport', city: 'Philadelphia', state: 'PA', country: 'US', lat: 39.8729, lng: -75.2437 },
  { iataCode: 'PIT', name: 'Pittsburgh International Airport', city: 'Pittsburgh', state: 'PA', country: 'US', lat: 40.4915, lng: -80.2329 },

  // Hawaii
  { iataCode: 'HNL', name: 'Daniel K. Inouye International Airport', city: 'Honolulu', state: 'HI', country: 'US', lat: 21.3245, lng: -157.9251 },

  // Louisiana
  { iataCode: 'MSY', name: 'Louis Armstrong New Orleans International Airport', city: 'New Orleans', state: 'LA', country: 'US', lat: 29.9934, lng: -90.2580 },

  // Utah
  { iataCode: 'SLC', name: 'Salt Lake City International Airport', city: 'Salt Lake City', state: 'UT', country: 'US', lat: 40.7899, lng: -111.9791 },

  // Oregon
  { iataCode: 'PDX', name: 'Portland International Airport', city: 'Portland', state: 'OR', country: 'US', lat: 45.5887, lng: -122.5975 },

  // Missouri
  { iataCode: 'STL', name: 'St. Louis Lambert International Airport', city: 'St. Louis', state: 'MO', country: 'US', lat: 38.7487, lng: -90.3700 },
  { iataCode: 'MCI', name: 'Kansas City International Airport', city: 'Kansas City', state: 'MO', country: 'US', lat: 39.2976, lng: -94.7139 },

  // Tennessee
  { iataCode: 'BNA', name: 'Nashville International Airport', city: 'Nashville', state: 'TN', country: 'US', lat: 36.1263, lng: -86.6774 },

  // Ohio
  { iataCode: 'CLE', name: 'Cleveland Hopkins International Airport', city: 'Cleveland', state: 'OH', country: 'US', lat: 41.4058, lng: -81.8539 },
  { iataCode: 'CMH', name: 'John Glenn Columbus International Airport', city: 'Columbus', state: 'OH', country: 'US', lat: 39.9980, lng: -82.8919 },

  // Indiana
  { iataCode: 'IND', name: 'Indianapolis International Airport', city: 'Indianapolis', state: 'IN', country: 'US', lat: 39.7173, lng: -86.2944 },

  // Wisconsin
  { iataCode: 'MKE', name: 'General Mitchell International Airport', city: 'Milwaukee', state: 'WI', country: 'US', lat: 42.9472, lng: -87.8966 },
];

// Build lookup map for fast access
const airportsByCode = new Map<string, Airport>(
  AIRPORTS.map((a) => [a.iataCode, a])
);

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth's radius in miles
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
 * Search airports by city, code, or name
 * Returns up to 10 results, requires at least 2 character query
 */
export function searchAirports(query: string): Airport[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  return AIRPORTS.filter(
    (a) =>
      a.iataCode.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q)
  ).slice(0, 10);
}

/**
 * Find the nearest airport to a given lat/lng
 */
export function findNearestAirport(lat: number, lng: number): Airport | null {
  if (AIRPORTS.length === 0) return null;

  let nearest = AIRPORTS[0];
  let minDistance = haversineDistance(lat, lng, nearest.lat, nearest.lng);

  for (const airport of AIRPORTS) {
    const dist = haversineDistance(lat, lng, airport.lat, airport.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = airport;
    }
  }

  return nearest;
}

/**
 * Get an airport by its IATA code
 */
export function getAirportByCode(code: string): Airport | null {
  return airportsByCode.get(code.toUpperCase()) || null;
}

/**
 * Get all airports
 */
export function getAllAirports(): Airport[] {
  return [...AIRPORTS];
}
