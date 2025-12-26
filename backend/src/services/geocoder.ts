import axios from 'axios';

export interface GeocodeResult {
  lat: number;
  lng: number;
  confidence: 'high' | 'low';
  formattedAddress: string;
}

interface GoogleGeocodeResponse {
  status: string;
  results: Array<{
    geometry: {
      location: { lat: number; lng: number };
      location_type: 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE';
    };
    formatted_address: string;
  }>;
}

export async function geocodeVenue(
  venue: string,
  city: string,
  country: string | null
): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY not set');
    return null;
  }

  const addressParts = [venue, city];
  if (country) {
    addressParts.push(country);
  }
  const address = addressParts.join(', ');

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

  try {
    const response = await axios.get<GoogleGeocodeResponse>(url);

    if (response.data.status !== 'OK' || response.data.results.length === 0) {
      return null;
    }

    const result = response.data.results[0];
    const { location, location_type } = result.geometry;

    const isHighConfidence =
      location_type === 'ROOFTOP' || location_type === 'RANGE_INTERPOLATED';

    return {
      lat: location.lat,
      lng: location.lng,
      confidence: isHighConfidence ? 'high' : 'low',
      formattedAddress: result.formatted_address,
    };
  } catch (error) {
    console.error('Geocoding failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
