/**
 * Validates IATA airport codes (3 uppercase letters)
 */
export function isValidAirportCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}
