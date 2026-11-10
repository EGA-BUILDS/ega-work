import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { markNoStore } from '@/lib/auth/http';

import { readSupabaseConfig } from './config';
import { SUPABASE_COOKIE_OPTIONS } from './cookies';

/**
 * Refreshes the Supabase session for the request.
 *
 * The updated cookies must be written to the outgoing response before it is
 * returned. Private pages verify the user independently.
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

   await supabase.auth.getUser().catch(() => null);

   return markNoStore(response);
}
