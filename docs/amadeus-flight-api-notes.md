# Amadeus Flight Offers Search API - Implementation Notes

This document contains research notes for implementing flight price fetching using the Amadeus Self-Service APIs.

## Quick Reference

| Item | Value |
|------|-------|
| API Version | v2 |
| Test Base URL | `https://test.api.amadeus.com` |
| Production Base URL | `https://api.amadeus.com` |
| Auth Endpoint | `/v1/security/oauth2/token` |
| Search Endpoint | `/v2/shopping/flight-offers` |

---

## Authentication

Amadeus uses **OAuth 2.0 Client Credentials Grant**.

### Token Request

```bash
curl -X POST "https://test.api.amadeus.com/v1/security/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_API_KEY&client_secret=YOUR_API_SECRET"
```

### Token Response

```json
{
  "type": "amadeusOAuth2Token",
  "username": "your@email.com",
  "application_name": "your-app",
  "client_id": "YOUR_API_KEY",
  "token_type": "Bearer",
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 1799,
  "state": "approved"
}
```

### Token Management Best Practices

1. **Cache the token** - Tokens last ~30 minutes (1799 seconds)
2. **Check expiration before each call** - Track `expires_in` and refresh proactively
3. **Handle 401 errors gracefully** - Refresh token on unauthorized responses
4. **Use SDKs when possible** - They handle token refresh automatically

### Current Implementation Issue

Our current `amadeusClient.ts` creates a singleton but doesn't handle token refresh well across Lambda cold starts. Consider:
- Storing token expiry time
- Refreshing token if within 60 seconds of expiry
- Handling 401 by re-authenticating

---

## Flight Offers Search API

### GET Method (Simple)

Quick integration with limited parameters.

```
GET /v2/shopping/flight-offers
```

#### Required Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `originLocationCode` | string | IATA city/airport code | `IAH` |
| `destinationLocationCode` | string | IATA city/airport code | `MIA` |
| `departureDate` | string | YYYY-MM-DD | `2025-03-15` |
| `adults` | integer | Number of adults (1-9) | `1` |

#### Optional Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `returnDate` | string | YYYY-MM-DD for round-trip | - |
| `children` | integer | Number of children (0-9) | 0 |
| `infants` | integer | Number of infants (0-9) | 0 |
| `travelClass` | string | ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST | - |
| `includedAirlineCodes` | string | Comma-separated IATA codes | - |
| `excludedAirlineCodes` | string | Comma-separated IATA codes | - |
| `nonStop` | boolean | Direct flights only | false |
| `currencyCode` | string | ISO 4217 code | - |
| `maxPrice` | integer | Maximum price | - |
| `max` | integer | Max results (1-250) | 250 |

#### Example GET Request

```bash
curl -X GET "https://test.api.amadeus.com/v2/shopping/flight-offers?\
originLocationCode=IAH&\
destinationLocationCode=MIA&\
departureDate=2025-03-15&\
returnDate=2025-03-17&\
adults=1&\
nonStop=false&\
currencyCode=USD&\
max=1" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### POST Method (Advanced)

Full functionality including multi-city, cabin restrictions, and advanced filtering.

```
POST /v2/shopping/flight-offers
```

#### POST Request Body Example

```json
{
  "currencyCode": "USD",
  "originDestinations": [
    {
      "id": "1",
      "originLocationCode": "IAH",
      "destinationLocationCode": "MIA",
      "departureDateTimeRange": {
        "date": "2025-03-15",
        "time": "10:00:00"
      }
    },
    {
      "id": "2",
      "originLocationCode": "MIA",
      "destinationLocationCode": "IAH",
      "departureDateTimeRange": {
        "date": "2025-03-17",
        "time": "17:00:00"
      }
    }
  ],
  "travelers": [
    {
      "id": "1",
      "travelerType": "ADULT"
    }
  ],
  "sources": ["GDS"],
  "searchCriteria": {
    "maxFlightOffers": 5,
    "flightFilters": {
      "cabinRestrictions": [
        {
          "cabin": "ECONOMY",
          "coverage": "MOST_SEGMENTS",
          "originDestinationIds": ["1", "2"]
        }
      ]
    }
  }
}
```

#### Search Criteria Options

| Option | Description |
|--------|-------------|
| `includedCheckedBagsOnly` | Only flights with included checked bags |
| `refundableFare` | Only refundable fares |
| `noRestrictionFare` | No restriction fares only |
| `noPenaltyFare` | No penalty fares only |
| `returnToDepartureAirport` | Same departure/return airport |
| `railSegmentAllowed` | Enable/disable rail segments |

---

## Response Structure

```json
{
  "meta": {
    "count": 1,
    "links": { "self": "..." }
  },
  "data": [
    {
      "type": "flight-offer",
      "id": "1",
      "source": "GDS",
      "instantTicketingRequired": false,
      "nonHomogeneous": false,
      "oneWay": false,
      "lastTicketingDate": "2025-03-14",
      "numberOfBookableSeats": 9,
      "itineraries": [
        {
          "duration": "PT2H30M",
          "segments": [
            {
              "departure": {
                "iataCode": "IAH",
                "terminal": "A",
                "at": "2025-03-15T08:00:00"
              },
              "arrival": {
                "iataCode": "MIA",
                "terminal": "N",
                "at": "2025-03-15T12:30:00"
              },
              "carrierCode": "UA",
              "number": "1234",
              "aircraft": { "code": "738" },
              "operating": { "carrierCode": "UA" },
              "duration": "PT2H30M",
              "id": "1",
              "numberOfStops": 0,
              "blacklistedInEU": false
            }
          ]
        }
      ],
      "price": {
        "currency": "USD",
        "total": "250.00",
        "base": "200.00",
        "fees": [
          { "amount": "0.00", "type": "SUPPLIER" },
          { "amount": "0.00", "type": "TICKETING" }
        ],
        "grandTotal": "250.00"
      },
      "pricingOptions": {
        "fareType": ["PUBLISHED"],
        "includedCheckedBagsOnly": true
      },
      "validatingAirlineCodes": ["UA"],
      "travelerPricings": [...]
    }
  ],
  "dictionaries": {
    "locations": { ... },
    "aircraft": { ... },
    "currencies": { ... },
    "carriers": { ... }
  }
}
```

### Key Response Fields for Our Use Case

| Field | Path | Description |
|-------|------|-------------|
| Price | `data[0].price.grandTotal` | Total price including taxes/fees |
| Currency | `data[0].price.currency` | Currency code |
| Airline | `data[0].validatingAirlineCodes[0]` | Primary airline |
| Duration | `data[0].itineraries[0].duration` | Flight duration (ISO 8601) |
| Stops | `data[0].itineraries[0].segments.length - 1` | Number of stops |

---

## Rate Limits

| Environment | Limit | Min Interval |
|-------------|-------|--------------|
| Test | 10 requests/second/user | 100ms between requests |
| Production | 40 requests/second/user | 100ms between requests |

### Error Code: 429 (Too Many Requests)

When rate limited, you'll receive a 429 status code. Implement exponential backoff.

---

## Quotas & Pricing

### Test Environment
- **Free monthly quota**: 1,000 - 10,000 calls depending on API
- **No billing** - limited by quota only
- **Uses cached/static data** - not real-time

### Production Environment
- **Same free monthly quota** as test
- **Pay-as-you-go** after quota exceeded
- **Cost**: ~€0.001 - €0.025 per call
- **Real-time data** from GDS

---

## Limitations & Known Issues

### Airlines NOT Available
The following airlines are **NOT** available through the API:
- American Airlines (AA)
- Delta (DL)
- British Airways (BA)
- Most Low-Cost Carriers (LCCs)

### Data Quality
- Only **published rates** are returned (not negotiated or special rates)
- Test environment uses **cached/static data** that may not reflect actual availability

---

## Implementation Recommendations for BJJ Tournament Tracker

### 1. Use GET for Simplicity
Our use case (round-trip, 1 adult, economy) is simple enough for GET requests.

### 2. Optimize API Calls
- **Batch by destination city** - Multiple tournaments in same city can share one lookup
- **Smart TTL caching** - Already implemented, good approach
- **Request only what we need** - Set `max=1` since we only need cheapest option

### 3. Handle Missing Airlines
Since AA, Delta, BA are unavailable:
- Display "Prices may vary" disclaimer
- Consider adding note about checking airline websites directly
- Don't show "no flights found" as definitive - just means not in Amadeus data

### 4. Current Code Improvements Needed

```typescript
// In amadeusClient.ts - Add token refresh logic
private tokenExpiry: Date | null = null;

async ensureAuthenticated(): Promise<void> {
  const now = new Date();
  const bufferMs = 60 * 1000; // 60 second buffer

  if (!this.accessToken || !this.tokenExpiry ||
      this.tokenExpiry.getTime() - now.getTime() < bufferMs) {
    await this.authenticate();
  }
}
```

### 5. Test vs Production

Currently using **test environment** (`api.amadeus.com` is actually production!).

**Action needed**: Update base URL to `test.api.amadeus.com` for development, or ensure production credentials are valid.

---

## Resources

- [Flight Offers Search API Reference](https://developers.amadeus.com/self-service/category/flights/api-doc/flight-offers-search/api-reference)
- [Flights Developer Guide](https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/resources/flights/)
- [Authorization Guide](https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/API-Keys/authorization/)
- [Rate Limits](https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/api-rate-limits/)
- [Test vs Production Environments](https://developers.amadeus.com/blog/test-and-production-environments-for-amadeus-self-service-apis-)
- [OpenAPI Specification](https://github.com/amadeus4dev/amadeus-open-api-specification)
- [Node.js SDK](https://github.com/amadeus4dev/amadeus-node)
- [Code Examples](https://github.com/amadeus4dev/amadeus-code-examples)

---

## TODO

- [ ] Get valid Amadeus API credentials (current ones return 401)
- [ ] Decide: Use test environment for dev, production for prod?
- [ ] Implement proper token refresh logic in `amadeusClient.ts`
- [ ] Add rate limiting/request queue to avoid 429 errors
- [ ] Add disclaimer about airline availability limitations
- [ ] Consider caching by destination city to reduce API calls
