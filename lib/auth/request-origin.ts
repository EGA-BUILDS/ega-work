export type TrustedOriginInput = Readonly<{
   origin: string | null;
   fetchSite?: string | null;
   /** Public origin resolved from SITE_URL or forwarded request headers. */
   expectedOrigin: string | null;
}>;

/**
 * Accepts a state-changing request only when it comes from the application's
 * trusted public origin. Callers resolve that origin the same way as auth
 * callbacks and sign-out: configured SITE_URL first, then forwarded public
 * headers, then the request Host. Comparing against Next's internal
 * `nextUrl.origin` rejects valid 127.0.0.1 and proxied requests.
 */
export function isTrustedRequestOrigin(input: TrustedOriginInput): boolean {
   const fetchSite = input.fetchSite;
   if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      return false;
   }

   if (!input.origin) {
      return true;
   }

   if (!input.expectedOrigin) {
      return false;
   }

   try {
      return new URL(input.origin).origin === input.expectedOrigin;
   } catch {
      return false;
   }
}
