import type { NextResponse } from 'next/server';

export const NO_STORE_CACHE_CONTROL = 'private, no-cache, no-store, must-revalidate, max-age=0';

/**
 * Prevents a CDN or reverse proxy from caching a response that carries auth
 * cookies. Auth pages and redirects must never be shared between users.
 */
export function markNoStore<T extends NextResponse>(response: T): T {
   response.headers.set('Cache-Control', NO_STORE_CACHE_CONTROL);
   response.headers.set('Expires', '0');
   response.headers.set('Pragma', 'no-cache');
   return response;
}
