export interface FlightSearchParams {
  origin: string;         // IATA code e.g., "DFW"
  destination: string;    // IATA code e.g., "MIA"
  departureDate: string;  // YYYY-MM-DD
  returnDate: string;     // YYYY-MM-DD
}

export interface FlightSearchResult {
  price: number;
  currency: string;
  airline: string | null;
}

interface AmadeusTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AmadeusFlightOffer {
  type: string;
  price: {
    currency: string;
    total: string;
    grandTotal: string;
  };
  validatingAirlineCodes?: string[];
}

interface AmadeusFlightSearchResponse {
  data: AmadeusFlightOffer[];
}

export class AmadeusClient {
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  // Use test environment - production requires separate contract/credentials
  private readonly baseUrl = 'https://test.api.amadeus.com';

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  async authenticate(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.apiKey,
        client_secret: this.apiSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Amadeus auth failed: ${response.status}`);
    }

    const data = (await response.json()) as AmadeusTokenResponse;
    this.accessToken = data.access_token;
    // Set expiry slightly before actual expiry to avoid edge cases
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);
  }

  isAuthenticated(): boolean {
    return (
      this.accessToken !== null &&
      this.tokenExpiry !== null &&
      this.tokenExpiry > new Date()
    );
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.isAuthenticated()) {
      await this.authenticate();
    }
  }

  async searchFlights(params: FlightSearchParams): Promise<FlightSearchResult | null> {
    await this.ensureAuthenticated();

    const searchParams = new URLSearchParams({
      originLocationCode: params.origin,
      destinationLocationCode: params.destination,
      departureDate: params.departureDate,
      returnDate: params.returnDate,
      adults: '1',
      currencyCode: 'USD',
      max: '1', // Just need the cheapest option
    });

    const response = await fetch(
      `${this.baseUrl}/v2/shopping/flight-offers?${searchParams}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`Amadeus search failed: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as AmadeusFlightSearchResponse;

    if (!data.data || data.data.length === 0) {
      return null;
    }

    const offer = data.data[0];
    return {
      price: parseFloat(offer.price.total),
      currency: offer.price.currency,
      airline: offer.validatingAirlineCodes?.[0] || null,
    };
  }
}

// Singleton instance for production use
let amadeusClient: AmadeusClient | null = null;

export function getAmadeusClient(): AmadeusClient {
  if (!amadeusClient) {
    const apiKey = process.env.AMADEUS_API_KEY;
    const apiSecret = process.env.AMADEUS_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error('AMADEUS_API_KEY and AMADEUS_API_SECRET must be set');
    }

    amadeusClient = new AmadeusClient(apiKey, apiSecret);
  }

  return amadeusClient;
}

// For testing: allows resetting the singleton
export function resetAmadeusClient(): void {
  amadeusClient = null;
}
