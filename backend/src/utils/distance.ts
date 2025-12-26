/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in miles
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

interface WithLocation {
  lat: number | null;
  lng: number | null;
}

interface WithDistance {
  distanceMiles: number;
}

/**
 * Filter items by distance from a point
 * @returns Filtered items with distanceMiles added, sorted by distance
 */
export function filterByDistance<T extends WithLocation>(
  items: T[],
  userLat: number,
  userLng: number,
  radiusMiles: number
): (T & WithDistance)[] {
  return items
    .filter((item): item is T & { lat: number; lng: number } =>
      item.lat !== null && item.lng !== null
    )
    .map((item) => ({
      ...item,
      distanceMiles: Math.round(haversineDistance(userLat, userLng, item.lat, item.lng)),
    }))
    .filter((item) => item.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}
