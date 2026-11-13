import type { BrowserContext, APIResponse } from '@playwright/test';

import { parseOrigin, validateTarget } from '../scripts/e2e-target.mjs';

/**
 * Vercel Protection Bypass for Automation — owner-only bootstrap (issue #28 / G1b).
 *
 * Disabled by default. It activates only when the OWNER sets, in their own
 * isolated environment, all three of:
 *
 *   E2E_G1B_PREVIEW_BYPASS   exactly 'I_ACCEPT_PREVIEW_BYPASS'
 *   E2E_G1B_PREVIEW_ORIGIN   the exact authorized immutable preview origin
 *                            (must equal the preflight-validated E2E_BASE_URL)
 *   E2E_VERCEL_PROTECTION_BYPASS  the bypass secret itself (never printed,
 *                            never committed, rotated on any leak)
 *
 * Behavior when active
 * --------------------
 * 1. The origin is re-validated against the explicit allowlist (same rules
 *    as the preflight).
 * 2. ONE same-origin request is sent with the bypass header and
 *    `x-vercel-set-bypass-cookie: true`, with NO redirect following — a
 *    cross-origin Location aborts the bootstrap.
 * 3. The cookie Vercel sets is stored only in the ephemeral browser context
 *    for this test; it is never written to storageState, never logged, and
 *    is discarded when the context closes.
 * 4. Access is re-checked with a SECOND same-origin request WITHOUT the
 *    bypass header. If the cookie was not established (401/403/otherwise
 *    unusable), the bootstrap fails closed with a named BLOCKED error.
 *
 * There is no global extraHTTPHeaders wiring anywhere in this suite, the
 * secret is never placed in a URL, and the normal public path is untouched
 * when the gate variables are absent.
 */

export const BYPASS_OPT_IN = 'I_ACCEPT_PREVIEW_BYPASS';

function blocked(message: string): Error {
   return new Error(`BLOCKED: ${message}`);
}

function isSuccessStatus(status: number): boolean {
   return status >= 200 && status < 300;
}

/** Same-origin-only redirect check: accepts a 3xx only when Location stays on baseUrl's origin. */
function sameOriginLocation(response: APIResponse, baseUrl: string): boolean {
   if (response.status() < 300 || response.status() >= 400) {
      return isSuccessStatus(response.status());
   }
   const location = response.headers()['location'];
   if (!location) {
      return false;
   }
   const resolved = parseOrigin(location, 'location');
   // parseOrigin accepts an absolute origin; for a relative path this fails — handle relative too.
   if (!resolved.ok) {
      try {
         return new URL(location, baseUrl).origin === baseUrl;
      } catch {
         return false;
      }
   }
   return resolved.origin === baseUrl;
}

/** Perform the one-time bypass against the authorized preview origin. No secrets are returned or logged. */
export async function bootstrapPreviewBypass(context: BrowserContext): Promise<void> {
   if (process.env.E2E_G1B_PREVIEW_BYPASS !== BYPASS_OPT_IN) {
      throw blocked(`E2E_G1B_PREVIEW_BYPASS must equal ${BYPASS_OPT_IN}. Refusing to bootstrap.`);
   }

   const target = validateTarget(process.env);
   if (!target.ok) {
      throw blocked(`the configured target is not authorized: ${target.reasons.join(', ')}.`);
   }

   const declaredOrigin = parseOrigin(
      (process.env.E2E_G1B_PREVIEW_ORIGIN ?? '').trim(),
      'E2E_G1B_PREVIEW_ORIGIN'
   );
   if (!declaredOrigin.ok || declaredOrigin.origin !== target.baseUrl) {
      throw blocked(
         'E2E_G1B_PREVIEW_ORIGIN must exactly equal the authorized preview origin (E2E_BASE_URL). Refusing to bootstrap.'
      );
   }

   const bypassSecret = process.env.E2E_VERCEL_PROTECTION_BYPASS;
   if (typeof bypassSecret !== 'string' || bypassSecret.trim() === '') {
      throw blocked(
         'E2E_VERCEL_PROTECTION_BYPASS is not set. Set it only in your isolated owner environment. Refusing to bootstrap.'
      );
   }

   // Single same-origin request, no redirect following.
   const response = await context.request.get(`${target.baseUrl}/`, {
      headers: {
         'x-vercel-protection-bypass': bypassSecret,
         'x-vercel-set-bypass-cookie': 'true',
      },
      maxRedirects: 0,
   });
   if (!sameOriginLocation(response, target.baseUrl)) {
      throw blocked(
         `the bypass bootstrap did not succeed (HTTP ${response.status()}). The secret may be wrong or the preview may not be Vercel-protected. Failing closed; rotate the secret if it may have leaked.`
      );
   }

   // Re-check access WITHOUT the header — proves the cookie landed in this context.
   const check = await context.request.get(`${target.baseUrl}/`, {
      maxRedirects: 0,
   });
   if (!sameOriginLocation(check, target.baseUrl)) {
      throw blocked(
         `access was not established (HTTP ${check.status()}). The bypass cookie was not accepted; do not retry blindly — verify the secret and the preview protection settings.`
      );
   }
}
