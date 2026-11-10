import type { CookieOptionsWithName } from '@supabase/ssr';

/**
 * This application reads the session only on the server, so browser JavaScript
 * never needs access to the auth cookies. The remaining defaults (path,
 * same-site, max age) come from @supabase/ssr and must stay consistent between
 * the middleware and request-scoped server clients.
 */
export const SUPABASE_COOKIE_OPTIONS: CookieOptionsWithName = {
   httpOnly: true,
};
