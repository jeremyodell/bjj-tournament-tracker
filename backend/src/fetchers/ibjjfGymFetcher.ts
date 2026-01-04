/**
 * Sanitize gym name by removing # characters (breaks GSI1SK) and trimming whitespace
 */
export function sanitizeGymName(name: string): string {
  return name.replace(/#/g, '').trim();
}
