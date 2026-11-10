import { NextResponse, type NextRequest } from 'next/server';

import { markNoStore } from '@/lib/auth/http';
import { loginPath, safeNextPath } from '@/lib/auth/redirect';
import { readSupabaseConfig } from '@/lib/supabase/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_EMAIL_OTP_TYPES = new Set([
   'email',
   'magiclink',
   'signup',
   'invite',
   'recovery',
   'email_change',
]);

function loginErrorRedirect(
   request: NextRequest,
   next: string,
   error: 'config' | 'link'
): NextResponse {
   const url = new URL(loginPath(next), request.url);
   url.searchParams.set('error', error);
   return markNoStore(NextResponse.redirect(url));
}

/**
 * Completes the magic-link journey.
 *
 * The default Supabase email template returns a PKCE `code`; a customized
 * template can instead return `token_hash` and `type`. Neither path trusts the
 * browser with an identity: the session is established only after Supabase
 * verifies the link, and `next` is restricted to an internal path.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
   const params = request.nextUrl.searchParams;
   const next = safeNextPath(params.get('next'));

   if (!readSupabaseConfig().ok) {
      return loginErrorRedirect(request, next, 'config');
   }

   const supabase = await createSupabaseServerClient();
   if (!supabase) {
      return loginErrorRedirect(request, next, 'config');
   }

   const code = params.get('code');
   const tokenHash = params.get('token_hash');
   const type = params.get('type');

   try {
      if (code) {
         const { error } = await supabase.auth.exchangeCodeForSession(code);
         if (!error) {
            return markNoStore(NextResponse.redirect(new URL(next, request.url)));
         }
      }

      if (tokenHash && type && ALLOWED_EMAIL_OTP_TYPES.has(type)) {
         const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
         if (!error) {
            return markNoStore(NextResponse.redirect(new URL(next, request.url)));
         }
      }
   } catch {
      // Fall through to the retryable login state.
   }

   return loginErrorRedirect(request, next, 'link');
}
