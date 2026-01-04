import type { IBJJFAcademy, IBJJFNormalizedGym } from './types.js';

/**
 * Sanitize gym name by removing # characters (breaks GSI1SK) and trimming whitespace
 */
export function sanitizeGymName(name: string): string {
  return name.replace(/#/g, '').trim();
}

/**
 * Map IBJJF academy to normalized gym format
 */
export function mapIBJJFAcademyToGym(academy: IBJJFAcademy): IBJJFNormalizedGym {
  return {
    org: 'IBJJF',
    externalId: String(academy.id),
    name: sanitizeGymName(academy.name),
    country: academy.country || undefined,
    countryCode: academy.countryCode || undefined,
    city: academy.city || undefined,
    address: academy.address || undefined,
    federation: academy.federation || undefined,
    website: academy.site || undefined,
    responsible: academy.responsible || undefined,
  };
}
