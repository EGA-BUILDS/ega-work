export type SiteOriginResult =
   | { ok: true; origin: string; source: 'configured' | 'request' }
   | { ok: false; reason: 'invalid_configured' | 'missing' };

type SiteOriginInput = Readonly<{
   configured?: string | null;
   forwardedHost?: string | null;
   forwardedProto?: string | null;
   host?: string | null;
   defaultProtocol?: 'http' | 'https';
}>;

function firstHeaderValue(value: string | null | undefined): string | null {
   if (!value) {
      return null;
   }

   const first = value.split(',')[0]?.trim();
   return first || null;
}

function normalizeHttpOrigin(value: string): string | null {
   try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
         return null;
      }

      if (url.username || url.password) {
         return null;
      }

      if (url.pathname !== '/' || url.search || url.hash) {
         return null;
      }

      return url.origin;
   } catch {
      return null;
   }
}

/**
 * Resolves the origin Supabase should redirect back to after a magic link.
 *
 * A configured site URL wins and fails closed when malformed. Otherwise the
 * request host is used for local development and previews. Supabase's redirect
 * URL allowlist remains the final authority on which origins may receive a
 * session, so deployments must list this origin in the project settings.
 */
export function resolveSiteOrigin(input: SiteOriginInput): SiteOriginResult {
   const configured = input.configured?.trim();
   if (configured) {
      const origin = normalizeHttpOrigin(configured);
      return origin
         ? { ok: true, origin, source: 'configured' }
         : { ok: false, reason: 'invalid_configured' };
   }

   const host = firstHeaderValue(input.forwardedHost) ?? firstHeaderValue(input.host);
   const protocol = firstHeaderValue(input.forwardedProto) ?? input.defaultProtocol ?? 'https';

   if (!host || (protocol !== 'http' && protocol !== 'https')) {
      return { ok: false, reason: 'missing' };
   }

   const origin = normalizeHttpOrigin(`${protocol}://${host}`);
   return origin ? { ok: true, origin, source: 'request' } : { ok: false, reason: 'missing' };
}
