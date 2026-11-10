export const DEFAULT_AUTHENTICATED_PATH = '/me';

const SAFE_INTERNAL_ORIGIN = 'https://ega-work.invalid';

/**
 * Keeps post-auth navigation inside this application.
 *
 * Callers may pass a user-controlled value, so only a same-origin path is
 * accepted. Protocol-relative URLs, absolute URLs, backslash tricks, control
 * characters, and auth routes that would cause a redirect loop fall back to the
 * personal space.
 */
export function safeNextPath(
   value: string | null | undefined,
   fallback: string = DEFAULT_AUTHENTICATED_PATH
): string {
   if (typeof value !== 'string') {
      return fallback;
   }

   const candidate = value.trim();
   if (!candidate.startsWith('/') || candidate.startsWith('//')) {
      return fallback;
   }

   if (/[\\\u0000-\u001f\u007f]/.test(candidate)) {
      return fallback;
   }

   let url: URL;
   try {
      url = new URL(candidate, SAFE_INTERNAL_ORIGIN);
   } catch {
      return fallback;
   }

   if (url.origin !== SAFE_INTERNAL_ORIGIN) {
      return fallback;
   }

   if (url.pathname === '/login' || url.pathname === '/auth' || url.pathname.startsWith('/auth/')) {
      return fallback;
   }

   return `${url.pathname}${url.search}${url.hash}`;
}

export function loginPath(next?: string | null): string {
   const target = safeNextPath(next);
   if (target === DEFAULT_AUTHENTICATED_PATH) {
      return '/login';
   }

   return `/login?next=${encodeURIComponent(target)}`;
}
