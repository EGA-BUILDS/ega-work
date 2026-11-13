#!/usr/bin/env node
// Preflight gate for E2E runs. Fails closed: any missing or mismatched value
// prints a BLOCKED reason and exits 1. Never prints secrets or credentials.
// Authoritative allowlist logic lives in scripts/e2e-target.mjs.

import { validateTarget } from './e2e-target.mjs';

const result = validateTarget(process.env);

if (!result.ok) {
   console.error('BLOCKED: E2E preflight failed. The run did not start.');
   for (const reason of result.reasons) {
      console.error(`  - ${reason}`);
   }
   console.error('');
   console.error('Required configuration (values are never printed):');
   console.error(
      '  E2E_BASE_URL           https origin of the target, or loopback http://localhost:3000'
   );
   console.error(
      '  E2E_ALLOWED_ORIGINS    comma-separated explicit allowlist that must contain E2E_BASE_URL'
   );
   console.error('');
   console.error(
      'Loopback origins http://localhost:3000 and http://127.0.0.1:3000 are always allowed.'
   );
   process.exit(1);
}

console.log('E2E preflight OK');
console.log(`  target origin: ${result.baseUrl}`);
console.log(`  allowlist size: ${result.allowlist.length} origin(s)`);
