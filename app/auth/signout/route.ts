import { NextResponse, type NextRequest } from 'next/server';

import { markNoStore } from '@/lib/auth/http';
import { resolveSiteOrigin } from '@/lib/auth/site-origin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function isTrustedSignOutRequest(request: NextRequest): boolean {
   const fetchSite = request.headers.get('sec-fetch-site');
   if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      return false;
   }

   const origin = request.headers.get('origin');
   if (!origin) {
      return true;
   }

   const expected = resolveSiteOrigin({
      configured: process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
      forwardedHost: request.headers.get('x-forwarded-host'),
      forwardedProto: request.headers.get('x-forwarded-proto'),
      host: request.headers.get('host'),
      defaultProtocol: request.nextUrl.protocol === 'http:' ? 'http' : 'https',
   });

   if (!expected.ok) {
      return false;
   }

   try {
      return new URL(origin).origin === expected.origin;
   } catch {
      return false;
   }
}

/** Signs out only through a same-origin POST. */
export async function POST(request: NextRequest): Promise<NextResponse> {
   if (!isTrustedSignOutRequest(request)) {
      return markNoStore(
         new NextResponse('Cross-origin sign-out is not allowed.', { status: 403 })
      );
   }

   const supabase = await createSupabaseServerClient();
   if (supabase) {
      try {
         const { error } = await supabase.auth.signOut();
         if (error) {
            return markNoStore(
               NextResponse.redirect(new URL('/me?error=signout', request.url), 303)
            );
         }
      } catch {
         return markNoStore(
            NextResponse.redirect(new URL('/me?error=signout', request.url), 303)
         );
      }
   }

   return markNoStore(NextResponse.redirect(new URL('/login', request.url), 303));
}
