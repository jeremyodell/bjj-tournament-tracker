/**
 * CI gate for backend/template.yaml (R1 + R2). Exits 1 on any violation.
 *   R1: no scheduled provider collection enabled under any deploy parameter set.
 *   R2: every non-catalog API route declares an authorizer.
 * Usage: npm run check:policy   (from backend/)
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadRepoPolicyInputs,
  findEnabledSchedules,
  findUnauthorizedRoutes,
  listApiRoutes,
  PUBLIC_CATALOG_ROUTES,
} from '../src/policy/templatePolicy.js';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const { template, paramSets } = loadRepoPolicyInputs(backendDir);

console.log(`Parameter sets checked: ${paramSets.map((p) => p.source).join('; ')}`);

const schedules = findEnabledSchedules(template, paramSets);
const unauth = findUnauthorizedRoutes(template, paramSets);
const routes = listApiRoutes(template, paramSets);

for (const r of routes) {
  const tag = !r.active ? 'inactive' : r.authorizer ? `auth=${r.authorizer}` : PUBLIC_CATALOG_ROUTES.has(r.route) ? 'public catalog' : 'NO AUTHORIZER';
  console.log(`  route ${r.route.padEnd(48)} ${tag}`);
}

let failed = false;
if (schedules.length) {
  failed = true;
  console.error('\nR1 FAIL: enabled schedules (provider collection must stay paused):');
  for (const s of schedules) console.error(`  ${s.id} [${s.source}]: ${s.reason}`);
} else {
  console.log('\nR1 OK: no schedule is enabled under any parameter set.');
}
if (unauth.length) {
  failed = true;
  console.error('\nR2 FAIL: non-catalog routes without an authorizer:');
  for (const r of unauth) console.error(`  ${r.route} (${r.resource})`);
} else {
  console.log('R2 OK: every non-catalog route declares an authorizer.');
}
process.exit(failed ? 1 : 0);
