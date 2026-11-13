// Authoritative allowlist logic for E2E target validation.
// Used by scripts/e2e-preflight.mjs. playwright.config.ts duplicates the minimal
// baseURL normalization (discovery only) and must stay in sync with this file.

/** Loopback origins are always allowed; anything remote must be explicitly listed. */
export const LOOPBACK_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

/**
 * Parse and strictly validate a configured origin. Returns the normalized origin
 * (scheme + host + port, no trailing slash) or a machine-readable reason.
 * Never returns or logs paths, query strings, or credentials.
 */
export function parseOrigin(raw, variableName) {
   if (typeof raw !== 'string' || raw.trim() === '') {
      return { ok: false, reason: `${variableName}_missing` };
   }
   const trimmed = raw.trim();
   let url;
   try {
      url = new URL(trimmed);
   } catch {
      return { ok: false, reason: `${variableName}_unparseable` };
   }
   if (url.username !== '' || url.password !== '') {
      return { ok: false, reason: `${variableName}_has_credentials` };
   }
   if (url.pathname !== '' && url.pathname !== '/') {
      return { ok: false, reason: `${variableName}_has_path` };
   }
   if (url.search !== '' || url.hash !== '') {
      return { ok: false, reason: `${variableName}_has_query_or_fragment` };
   }
   const isLoopbackHttp = url.protocol === 'http:' && LOOPBACK_ORIGINS.includes(url.origin);
   if (url.protocol !== 'https:' && !isLoopbackHttp) {
      return { ok: false, reason: `${variableName}_not_https` };
   }
   return { ok: true, origin: url.origin };
}

/**
 * Parse a comma-separated allowlist. Every entry must pass the same strict
 * origin validation; one bad entry blocks the whole run (fail closed).
 */
export function parseAllowlist(raw) {
   const origins = [...LOOPBACK_ORIGINS];
   const entries = typeof raw === 'string' ? raw.split(',') : [];
   for (const entry of entries) {
      const trimmed = entry.trim();
      if (trimmed === '') {
         continue;
      }
      const parsed = parseOrigin(trimmed, 'E2E_ALLOWED_ORIGINS');
      if (!parsed.ok) {
         return { ok: false, reason: parsed.reason, entry: trimmed };
      }
      if (!origins.includes(parsed.origin)) {
         origins.push(parsed.origin);
      }
   }
   return { ok: true, origins };
}

/**
 * Validate E2E_BASE_URL against the explicit allowlist.
 * Returns { ok: true, baseUrl } or { ok: false, reasons: string[] }.
 */
export function validateTarget(env = process.env) {
   const reasons = [];

   const base = parseOrigin(env.E2E_BASE_URL, 'E2E_BASE_URL');
   if (!base.ok) {
      reasons.push(base.reason);
   }

   const allowlist = parseAllowlist(env.E2E_ALLOWED_ORIGINS);
   if (!allowlist.ok) {
      reasons.push(`${allowlist.reason} (entry: ${allowlist.entry})`);
   }

   if (!base.ok || !allowlist.ok) {
      return { ok: false, reasons };
   }

   if (!allowlist.origins.includes(base.origin)) {
      reasons.push('E2E_BASE_URL_not_in_allowlist');
      return { ok: false, reasons };
   }

   return { ok: true, baseUrl: base.origin, allowlist: allowlist.origins };
}
