import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { readSupabaseConfig } from './config';
import { SUPABASE_COOKIE_OPTIONS } from './cookies';

/**
 * Creates a request-scoped Supabase client backed by Next.js cookies.
 *
 * Returns null when auth configuration is missing so callers can render a
 * configuration state instead of throwing. Never use a service-role key here:
 * this client only reads and refreshes the verified user session.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
   const config = readSupabaseConfig();
   if (!config.ok) {
      return null;
   }

   const cookieStore = await cookies();

   return createServerClient(config.config.url, config.config.anonKey, {
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
      cookies: {
         getAll() {
            return cookieStore.getAll();
         },
         setAll(cookiesToSet) {
            try {
               cookiesToSet.forEach(({ name, value, options }) => {
                  cookieStore.set(name, value, options);
               });
            } catch {
               // Server Components cannot write cookies. Middleware refreshes
               // sessions; route handlers and server actions can write here.
            }
         },
      },
   });
}
