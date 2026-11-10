import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { markNoStore } from '@/lib/auth/http';
import { loginPath } from '@/lib/auth/redirect';

import { readSupabaseConfig } from './config';
import { SUPABASE_COOKIE_OPTIONS } from './cookies';

function copyAuthCookies(from: NextResponse, to: NextResponse): void {
   from.cookies.getAll().forEach((cookie) => {
      to.cookies.set(cookie);
   });
}

/**
 * Refreshes the Supabase session for the request and protects `/me`.
 *
 * The updated cookies must be written to the outgoing response before it is
 * returned. Unauthenticated access to the personal space is redirected to
 * `/login` with a safe same-origin return path.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
   const config = readSupabaseConfig();
   if (!config.ok) {
      return NextResponse.next({ request });
   }

   let response = NextResponse.next({ request });

   const supabase = createServerClient(config.config.url, config.config.anonKey, {
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
      cookies: {
         getAll() {
            return request.cookies.getAll();
         },
         setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value }) => {
               request.cookies.set(name, value);
            });
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => {
               response.cookies.set(name, value, options);
            });
            Object.entries(headers).forEach(([name, value]) => {
               response.headers.set(name, value);
            });
         },
      },
   });

   const userResult = await supabase.auth.getUser().catch(() => null);
   const user = userResult?.data.user ?? null;
   const { pathname, search } = request.nextUrl;
   const protectedRoute = pathname === '/me' || pathname.startsWith('/me/');
   const transientError =
      !userResult ||
      userResult.error?.name === 'AuthRetryableFetchError' ||
      userResult.error?.name === 'AuthUnknownError';

   if (!user && protectedRoute && !transientError) {
      const redirectResponse = new NextResponse(null, {
         status: 307,
         headers: { Location: loginPath(`${pathname}${search}`) },
      });
      copyAuthCookies(response, redirectResponse);
      return markNoStore(redirectResponse);
   }

   return markNoStore(response);
}
